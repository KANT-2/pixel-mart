"""닉네임은 대소문자 구분 없이 하나뿐 — 가입 시 겹치면 #숫자, 변경 시 겹치면 409

로컬 DB 필요, 없으면 건너뜀
"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app


@pytest.fixture
async def login():
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1 FROM users LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다")
    clients: list[AsyncClient] = []

    async def make(email: str, nickname: str) -> AsyncClient:
        c = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
        clients.append(c)
        res = await c.post("/api/auth/dev-login", json={"email": email, "nickname": nickname})
        assert res.status_code == 200
        return c

    yield make
    for c in clients:
        await c.aclose()
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email LIKE 'nick-%@pixelmart.test'"))


async def test_new_account_with_taken_nickname_gets_suffix(login):
    first = await login("nick-a@pixelmart.test", "슬라임킹")
    second = await login("nick-b@pixelmart.test", "슬라임킹")
    a = (await first.get("/api/auth/me")).json()["nickname"]
    b = (await second.get("/api/auth/me")).json()["nickname"]
    assert a == "슬라임킹"
    assert b.startswith("슬라임킹#") and len(b) == len("슬라임킹#0000")


async def test_change_to_taken_nickname_is_409_case_insensitive(login):
    await login("nick-c@pixelmart.test", "PixelBear")
    other = await login("nick-d@pixelmart.test", "다른곰")
    res = await other.patch("/api/users/me", json={"nickname": "pixelbear"})
    assert res.status_code == 409
    assert (await other.patch("/api/users/me", json={"nickname": "다른곰"})).status_code == 200  # 내 닉네임 그대로는 OK
    assert (await other.patch("/api/users/me", json={"nickname": "새로운곰"})).json()["nickname"] == "새로운곰"


async def test_nickname_check(login):
    me = await login("nick-e@pixelmart.test", "체크곰")
    await login("nick-f@pixelmart.test", "남의곰")
    check = lambda n: me.get("/api/users/nickname-check", params={"nickname": n})  # noqa: E731
    assert (await check("남의곰")).json() == {"nickname": "남의곰", "available": False}
    assert (await check("체크곰")).json()["available"] is True  # 내 닉네임
    assert (await check("아무도없는곰")).json()["available"] is True
    assert (await check("x" * 31)).status_code == 422
