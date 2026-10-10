"""내 정보(닉네임·아바타) API — 로컬 DB 필요 (DB가 없으면 건너뜀)"""

import base64

import pytest
from sqlalchemy import text

from app.core.db import engine
from app.services.avatar import MAX_AVATAR_BYTES, PNG_SIGNATURE, validate_avatar_data_url

PREFIX = "data:image/png;base64,"


def png_data_url(size: int = 100) -> str:
    raw = PNG_SIGNATURE + b"\0" * (size - len(PNG_SIGNATURE))
    return PREFIX + base64.b64encode(raw).decode()


# --- 순수 함수 (DB 없이) ---


def test_avatar_accepts_small_png():
    url = png_data_url(MAX_AVATAR_BYTES)
    assert validate_avatar_data_url(url) == url


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("https://example.com/a.png", "data:image/png"),
        ("data:image/jpeg;base64," + base64.b64encode(PNG_SIGNATURE).decode(), "data:image/png"),
        (PREFIX + "!!!not-base64!!!", "base64"),
        (PREFIX + base64.b64encode(b"GIF89a....").decode(), "PNG"),
        (png_data_url(MAX_AVATAR_BYTES + 1), "200KB"),
    ],
    # 값이 길어 테스트 이름이 환경 변수 길이 제한(Windows 32767자)을 넘지 않게 짧은 id 사용
    ids=["not-data-url", "jpeg", "bad-base64", "not-png", "too-large"],
)
def test_avatar_rejects_invalid(value, message):
    with pytest.raises(ValueError, match=message):
        validate_avatar_data_url(value)


# --- API ---


@pytest.fixture
async def db_ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM users LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")


async def login(client, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200


async def test_users_me_requires_login(client, db_ready):
    assert (await client.patch("/api/users/me", json={"nickname": "X"})).status_code == 401
    assert (await client.put("/api/users/me/avatar", json={"avatarUrl": png_data_url()})).status_code == 401


async def test_update_nickname_strips_spaces(client, db_ready):
    await login(client, "users1@pixelmart.test")
    res = await client.patch("/api/users/me", json={"nickname": "  PLAYER 1  "})
    assert res.status_code == 200
    assert res.json()["nickname"] == "PLAYER 1"
    assert (await client.get("/api/auth/me")).json()["nickname"] == "PLAYER 1"


@pytest.mark.parametrize("nickname", ["", "   ", "가" * 31])
async def test_invalid_nickname_is_422(client, db_ready, nickname):
    await login(client, "users2@pixelmart.test")
    res = await client.patch("/api/users/me", json={"nickname": nickname})
    assert res.status_code == 422


async def test_put_and_delete_avatar(client, db_ready):
    await login(client, "users3@pixelmart.test")
    url = png_data_url()

    saved = await client.put("/api/users/me/avatar", json={"avatarUrl": url})
    assert saved.status_code == 200
    assert saved.json()["avatarUrl"] == url
    assert (await client.get("/api/auth/me")).json()["avatarUrl"] == url

    deleted = await client.delete("/api/users/me/avatar")
    assert deleted.json()["avatarUrl"] is None


async def test_too_large_avatar_is_422_and_not_saved(client, db_ready):
    await login(client, "users4@pixelmart.test")
    await client.delete("/api/users/me/avatar")

    res = await client.put("/api/users/me/avatar", json={"avatarUrl": png_data_url(MAX_AVATAR_BYTES + 1)})
    assert res.status_code == 422
    assert "200KB" in res.text
    assert (await client.get("/api/auth/me")).json()["avatarUrl"] is None
