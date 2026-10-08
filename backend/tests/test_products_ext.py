"""상품 API 확장 (찜 여부 · 가격/신상품 필터 · 여러 카테고리 · 인기순) — 로컬 DB 필요"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM wishlists, products LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")


async def count_where(sql: str) -> int:
    async with engine.connect() as conn:
        return await conn.scalar(text(f"SELECT count(*) FROM products WHERE {sql}"))


async def test_anonymous_is_wished_false(client):
    body = (await client.get("/api/products", params={"size": 5})).json()
    assert all(item["isWished"] is False for item in body["items"])
    assert (await client.get("/api/products/1")).json()["isWished"] is False


async def test_is_wished_for_logged_in_user(client):
    await client.post("/api/auth/dev-login", json={"email": "prodwish@pixelmart.test"})
    await client.delete("/api/wishlist/2")
    await client.put("/api/wishlist/1")

    items = (await client.get("/api/products", params={"size": 3})).json()["items"]
    assert [(i["id"], i["isWished"]) for i in items] == [(1, True), (2, False), (3, False)]
    assert (await client.get("/api/products/1")).json()["isWished"] is True


async def test_price_range_filter(client):
    body = (await client.get("/api/products", params={"minPrice": 10000, "maxPrice": 20000, "size": 60})).json()
    assert body["total"] == await count_where("price BETWEEN 10000 AND 20000")
    assert body["total"] > 0
    assert all(10000 <= item["price"] <= 20000 for item in body["items"])


async def test_min_price_over_max_is_422(client):
    res = await client.get("/api/products", params={"minPrice": 30000, "maxPrice": 10000})
    assert res.status_code == 422
    assert (await client.get("/api/products", params={"minPrice": -1})).status_code == 422


async def test_is_new_filter(client):
    body = (await client.get("/api/products", params={"isNew": "true", "size": 60})).json()
    assert body["total"] == await count_where("is_new")
    assert all(item["isNew"] for item in body["items"])


async def test_multiple_categories(client):
    body = (await client.get("/api/products", params={"category": "keycap,figure", "size": 60})).json()
    assert body["total"] == await count_where("category_slug IN ('keycap', 'figure')")
    assert {item["categorySlug"] for item in body["items"]} <= {"keycap", "figure"}


async def test_popular_sort_by_wish_count(client):
    # 다른 테스트의 찜과 섞이지 않도록, 찜이 하나도 없는 상품 3개를 골라 찜 수를 2:1:0으로 만든다
    async with engine.connect() as conn:
        rows = await conn.scalars(
            text(
                "SELECT id FROM products p WHERE NOT EXISTS (SELECT 1 FROM wishlists w WHERE w.product_id = p.id) "
                "ORDER BY id DESC LIMIT 3"
            )
        )
        low, mid, top = sorted(rows.all())
    for email, product_ids in (("pop1@pixelmart.test", [top, mid]), ("pop2@pixelmart.test", [top])):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await c.post("/api/auth/dev-login", json={"email": email})
            for product_id in product_ids:
                await c.put(f"/api/wishlist/{product_id}")

    items = (await client.get("/api/products", params={"sort": "popular", "size": 60, "page": 1})).json()["items"]
    order = [i["id"] for i in items]
    assert order.index(top) < order.index(mid)
    # 찜 0개 상품은 찜 있는 상품 뒤 (60개 안에 없을 수도 있음)
    assert low not in order or order.index(mid) < order.index(low)
