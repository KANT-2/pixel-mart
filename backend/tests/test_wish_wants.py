"""위시맵 WANT — 닉네임 공개(opt-in)한 작성자만 닉네임·아바타 노출·검색, 지역 블록별 WANT 수, 거래글 하나 조회

로컬 DB 필요, 없으면 건너뜀
"""

import json
from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app

TEST_REGIONS = [
    ("WSW", "sido", None, "위시시"),
    ("WSW1", "sigungu", "WSW", "일구"),
    ("WSW1-01", "zone", "WSW1", "가동"),
    ("WSW1-02", "zone", "WSW1", "나동"),
]
PRODUCT = 3


@pytest.fixture
async def users():
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

        async def make(nickname: str, zone: str = "WSW1-01", public: bool = False) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": f"wsw-{nickname}@pixelmart.test", "nickname": nickname})
            body = {"regionCode": zone, "interestIds": [], "nicknamePublic": public}
            res = await c.put("/api/users/me/local", json=body)
            assert res.status_code == 200 and res.json()["nicknamePublic"] is public
            return c

        yield make

    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM trade_posts WHERE region_code LIKE 'WSW%'"))
        await conn.execute(text("UPDATE users SET region_code = NULL WHERE region_code LIKE 'WSW%'"))
        await conn.execute(text("DELETE FROM users WHERE email LIKE 'wsw-%@pixelmart.test'"))
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'WSW%' AND level = :l"), {"l": level})


async def post(c: AsyncClient, kind: str = "want", name: str = "보물상자 소품함", product: int | None = PRODUCT) -> int:
    body = {"kind": kind, "itemName": name, "productId": product}
    if kind != "want":
        body["condition"] = "new"
    res = await c.post("/api/local/trades", json=body)
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def wants(c: AsyncClient, **params) -> list[dict]:
    res = await c.get("/api/local/trades", params={"region": "WSW", "kind": "want"} | params)
    assert res.status_code == 200, res.text
    return res.json()["items"]


async def test_author_only_for_opted_in_want_posts(users):
    hidden = await users("숨은픽셀")
    shown = await users("공개픽셀", public=True)
    await post(hidden)
    shown_want = await post(shown)
    shown_have = await post(shown, kind="have")

    rows = (await shown.get("/api/local/trades", params={"region": "WSW"})).json()["items"]
    by_id = {r["id"]: r["author"] for r in rows}
    assert by_id[shown_want] == {"nickname": "공개픽셀", "avatarUrl": None}
    assert by_id[shown_have] is None  # HAVE·SELL은 계속 익명
    assert "숨은픽셀" not in json.dumps(rows)


async def test_nickname_search_matches_only_opted_in_authors(users):
    await post(await users("픽셀곰", public=True))
    await post(await users("픽셀곰비밀"))  # 동의 안 함 → 검색에 안 나옴
    viewer = await users("구경꾼")

    assert [r["author"]["nickname"] for r in await wants(viewer, nickname="픽셀곰")] == ["픽셀곰"]
    assert await wants(viewer, nickname="%") == []  # LIKE 와일드카드는 글자 그대로
    res = await viewer.get("/api/local/trades", params={"nickname": "x" * 31})
    assert res.status_code == 422


async def test_wish_wants_counts_subtree_and_rejects_unknown_region(users):
    a = await users("가동주민")
    b = await users("나동주민", zone="WSW1-02")
    await post(a)
    await post(a, name="이름만 있는 물건", product=None)
    await post(a, kind="have")  # WANT만 센다
    await post(b)

    res = await a.get("/api/local/wish-wants", params={"codes": "WSW1-01,WSW1-02,WSW1"})
    assert res.status_code == 200
    rows = {r["regionCode"]: r for r in res.json()}
    assert (rows["WSW1-01"]["count"], rows["WSW1-02"]["count"], rows["WSW1"]["count"]) == (2, 1, 3)
    assert rows["WSW1-01"]["images"][0] is None and rows["WSW1-01"]["images"][1].startswith("/")
    assert rows["WSW1"]["sample"] is False
    assert (await a.get("/api/local/wish-wants", params={"codes": "WSW1,NOPE"})).status_code == 404


async def test_get_single_trade_hides_closed_posts_from_others(users):
    owner = await users("글쓴이", public=True)
    other = await users("다른이")
    post_id = await post(owner)

    res = await other.get(f"/api/local/trades/{post_id}")
    assert res.status_code == 200 and res.json()["author"]["nickname"] == "글쓴이"
    await owner.patch(f"/api/local/trades/{post_id}", json={"status": "hidden"})
    assert (await other.get(f"/api/local/trades/{post_id}")).status_code == 404
    assert (await owner.get(f"/api/local/trades/{post_id}")).status_code == 200
    assert (await other.get("/api/local/trades/99999999")).status_code == 404
