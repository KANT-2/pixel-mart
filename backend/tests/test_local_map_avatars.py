"""덕력지도 아바타 핀 — 동의자만, 5명 미만 비공개, 개인 식별 정보 없음 (로컬 DB 필요, 없으면 건너뜀)

다른 테스트·샘플과 섞이지 않게 테스트 전용 지역(AVT › AVT1·AVT2 › 생활권)을 만들고 끝나면 정리한다.
"""

import json
from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from app.services import local_stats

ZONE_A, ZONE_B, OTHER = "AVT1-01", "AVT1-02", "AVT2-01"
TEST_REGIONS = [
    ("AVT", "sido", None, "아바타시"),
    ("AVT1", "sigungu", "AVT", "일구"),
    ("AVT2", "sigungu", "AVT", "이구"),
    ("AVT1-01", "zone", "AVT1", "가동"),
    ("AVT1-02", "zone", "AVT1", "나동"),
    ("AVT2-01", "zone", "AVT2", "다동"),
]
NARUTO = 11
PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture
async def users(monkeypatch):
    """users(email, region, opt_in, avatar, interests) → 로그인된 클라이언트"""
    monkeypatch.setattr(local_stats, "EXCLUDED_EMAIL_SUFFIX", "@never.invalid")
    try:
        async with engine.begin() as conn:
            for code, level, parent, name in TEST_REGIONS:
                await conn.execute(
                    text(
                        "INSERT INTO regions (code, level, parent_code, name) VALUES (:c, :l, :p, :n) "
                        "ON CONFLICT (code) DO NOTHING"
                    ),
                    {"c": code, "l": level, "p": parent, "n": name},
                )
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")

    async with AsyncExitStack() as stack:

        async def make(
            email: str, region: str = ZONE_A, opt_in: bool = True, avatar: bool = False, interests=()
        ) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email})
            body = {"regionCode": region, "interestIds": list(interests), "mapAvatarOptIn": opt_in}
            assert (await c.put("/api/users/me/local", json=body)).status_code == 200
            if avatar:
                await c.put("/api/users/me/avatar", json={"avatarUrl": PNG})
            else:
                await c.delete("/api/users/me/avatar")
            return c

        yield make

    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET region_code = NULL, map_avatar_opt_in = false WHERE region_code LIKE 'AVT%'")
        )
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'AVT%' AND level = :l"), {"l": level})


def blocks(rows: list[dict]) -> dict[str, dict]:
    return {r["regionCode"]: r for r in rows}


async def test_opt_in_is_off_by_default_and_saved(users):
    c = await users("avatar-default@pixelmart.test", opt_in=False)
    assert (await c.get("/api/users/me/local")).json()["mapAvatarOptIn"] is False
    body = {"regionCode": ZONE_A, "interestIds": [], "mapAvatarOptIn": True}
    assert (await c.put("/api/users/me/local", json=body)).json()["mapAvatarOptIn"] is True


async def test_below_five_hides_count_and_avatars(users):
    for n in range(4):
        await users(f"avatar-few{n}@pixelmart.test", avatar=True)
    rows = blocks(
        (
            await (await users("avatar-viewer@pixelmart.test", opt_in=False)).get(
                "/api/local/map-avatars", params={"region": "AVT1"}
            )
        ).json()
    )
    assert rows[ZONE_A] == {
        "regionCode": ZONE_A,
        "regionName": "아바타시 일구 가동",
        "count": None,
        "belowThreshold": True,
        "avatars": [],
    }


async def test_five_opted_in_show_avatars_without_identity(users):
    for n in range(3):
        await users(f"avatar-a{n}@pixelmart.test", avatar=True)
    for n in range(2):
        await users(f"avatar-b{n}@pixelmart.test")  # 아바타 없음 → 기본 슬라임(null)
    await users("avatar-off@pixelmart.test", opt_in=False, avatar=True)  # 동의 안 함 → 제외
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)

    res = await viewer.get("/api/local/map-avatars", params={"region": "AVT1"})
    zone = blocks(res.json())[ZONE_A]
    assert zone["count"] == 5 and zone["belowThreshold"] is False
    assert sorted(zone["avatars"], key=str) == sorted([PNG] * 3 + [None] * 2, key=str)
    raw = json.dumps(res.json())
    assert "pixelmart.test" not in raw and "avatar-a0" not in raw  # 이메일·닉네임 없음
    assert set(zone) == {"regionCode", "regionName", "count", "belowThreshold", "avatars"}


async def test_parent_block_sums_children_and_caps_at_six(users):
    for n in range(4):
        await users(f"avatar-za{n}@pixelmart.test", region=ZONE_A)
    for n in range(4):
        await users(f"avatar-zb{n}@pixelmart.test", region=ZONE_B)
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    top = blocks((await viewer.get("/api/local/map-avatars", params={"region": "AVT"})).json())
    assert top["AVT1"]["count"] == 8 and len(top["AVT1"]["avatars"]) == 6  # 하위 합산, 최대 6개
    assert top["AVT2"]["belowThreshold"] is True


async def test_interest_filter_and_leaf_region(users):
    for n in range(5):
        await users(f"avatar-n{n}@pixelmart.test", interests=[NARUTO])
    await users("avatar-x@pixelmart.test")
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    zone = (await viewer.get("/api/local/map-avatars", params={"region": ZONE_A, "interest": NARUTO})).json()
    assert [(r["regionCode"], r["count"]) for r in zone] == [(ZONE_A, 5)]  # 생활권은 자기 자신 한 칸


@pytest.mark.parametrize(("params", "status_code"), [({"region": "NOPE"}, 404), ({"interest": 99999}, 404)])
async def test_validation(client, params, status_code):
    assert (await client.get("/api/local/map-avatars", params=params)).status_code == status_code
