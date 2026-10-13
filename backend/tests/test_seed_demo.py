"""시연용 데모 이웃 — 닉네임으로 찾을 수 있고, 사이트 상품 WANT라 선물할 수 있으며, 여러 번 실행해도 같다

로컬 DB 필요, 없으면 건너뜀
"""

import pytest
from sqlalchemy import text

from app.core.db import SessionLocal, engine
from scripts.seed_demo import seed_demo


@pytest.fixture
async def demo():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM products LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다")
    async with SessionLocal() as db:
        first = await seed_demo(db)
    async with SessionLocal() as db:
        second = await seed_demo(db)
    yield first, second
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM users WHERE email LIKE '%@demo.pixelmart.test'"))
        await conn.execute(text("DELETE FROM users WHERE email = 'demo-gifter@pixelmart.test'"))


async def test_demo_neighbors_are_searchable_and_giftable(client, demo):
    first, second = demo
    assert "데모 이웃 8명" in first and second.endswith("새 WANT 글 0개, 새 HAVE 글 0개")  # 다시 실행해도 중복 없음

    rows = (await client.get("/api/local/trades", params={"nickname": "픽셀곰", "kind": "want"})).json()["items"]
    assert len(rows) == 2
    assert all(r["isDemo"] and r["kind"] == "want" and r["product"] and not r["isSample"] for r in rows)
    assert rows[0]["author"]["nickname"] == "픽셀곰"

    await client.post("/api/auth/dev-login", json={"email": "demo-gifter@pixelmart.test", "nickname": "선물러테스트"})
    post = rows[0]
    res = await client.post("/api/gifts", json={"tradePostId": post["id"], "productId": post["product"]["id"]})
    assert res.status_code == 201, res.text


async def test_demo_neighbors_have_posts_to_request(client, demo):
    # 데모 이웃의 HAVE 글에는 바로 교환을 신청해 볼 수 있다
    haves = (await client.get("/api/local/trades", params={"nickname": "슬라임킹", "kind": "have"})).json()["items"]
    assert len(haves) == 2 and all(h["product"] and h["condition"] and h["isDemo"] for h in haves)

    await client.post("/api/auth/dev-login", json={"email": "demo-gifter@pixelmart.test", "nickname": "선물러테스트"})
    res = await client.post("/api/local/trade-requests", json={"postId": haves[0]["id"]})
    assert res.status_code == 201, res.text


async def test_demo_neighbors_show_on_map_with_extra_hearts(client, demo):
    # 데모 이웃은 테스트 계정(.test)과 달리 지도 캐릭터·이웃 카드로 보이고, 하트 3개를 넘긴 이웃도 있다
    blocks = (await client.get("/api/local/map-avatars", params={"region": "41135"})).json()
    cards = {c["nickname"]: c for b in blocks for c in b["cards"] if c and not c["isSample"]}
    assert cards["픽셀곰"]["hearts"] == 9 and cards["픽셀곰"]["level"] == "단골 이웃"  # 295점
    assert cards["도트냥"]["hearts"] == 2 and cards["도트냥"]["coinBand"] == "교환 1회+"
