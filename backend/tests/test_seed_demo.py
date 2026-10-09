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
    assert "데모 이웃 8명" in first and second.endswith("새 WANT 글 0개")  # 다시 실행해도 중복 없음

    rows = (await client.get("/api/local/trades", params={"nickname": "픽셀곰"})).json()["items"]
    assert len(rows) == 2
    assert all(r["isDemo"] and r["kind"] == "want" and r["product"] and not r["isSample"] for r in rows)
    assert rows[0]["author"]["nickname"] == "픽셀곰"

    await client.post("/api/auth/dev-login", json={"email": "demo-gifter@pixelmart.test", "nickname": "선물러테스트"})
    post = rows[0]
    res = await client.post("/api/gifts", json={"tradePostId": post["id"], "productId": post["product"]["id"]})
    assert res.status_code == 201, res.text
