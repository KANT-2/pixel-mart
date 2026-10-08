"""장바구니 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM cart_items LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200
    # 재실행해도 같은 결과가 나오도록 장바구니를 비우고 시작
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")


async def test_cart_requires_login(client):
    res = await client.get("/api/cart")
    assert res.status_code == 401


async def test_add_and_get_totals(client):
    await login(client, "cart1@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 1, "quantity": 2})
    res = await client.post("/api/cart/items", json={"productId": 2, "quantity": 1})
    assert res.status_code == 200

    cart = (await client.get("/api/cart")).json()
    price1 = (await client.get("/api/products/1")).json()["price"]
    price2 = (await client.get("/api/products/2")).json()["price"]
    assert [i["product"]["id"] for i in cart["items"]] == [1, 2]
    assert cart["items"][0]["subtotal"] == price1 * 2
    assert cart["totalQuantity"] == 3
    assert cart["totalPrice"] == price1 * 2 + price2


async def test_add_same_product_merges_quantity(client):
    await login(client, "cart2@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 3, "quantity": 2})
    cart = (await client.post("/api/cart/items", json={"productId": 3, "quantity": 5})).json()
    assert len(cart["items"]) == 1
    assert cart["items"][0]["quantity"] == 7


async def test_add_over_max_quantity_is_400(client):
    await login(client, "cart3@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 3, "quantity": 90})
    res = await client.post("/api/cart/items", json={"productId": 3, "quantity": 10})
    assert res.status_code == 400
    assert (await client.get("/api/cart")).json()["items"][0]["quantity"] == 90


async def test_add_missing_product_is_404(client):
    await login(client, "cart4@pixelmart.test")
    res = await client.post("/api/cart/items", json={"productId": 999, "quantity": 1})
    assert res.status_code == 404


@pytest.mark.parametrize("quantity", [0, 100])
async def test_quantity_out_of_range_is_422(client, quantity):
    await login(client, "cart5@pixelmart.test")
    res = await client.post("/api/cart/items", json={"productId": 1, "quantity": quantity})
    assert res.status_code == 422

    await client.post("/api/cart/items", json={"productId": 1, "quantity": 1})
    res = await client.patch("/api/cart/items/1", json={"quantity": quantity})
    assert res.status_code == 422


async def test_update_and_delete(client):
    await login(client, "cart6@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 4, "quantity": 1})

    updated = await client.patch("/api/cart/items/4", json={"quantity": 5})
    assert updated.json()["items"][0]["quantity"] == 5

    deleted = await client.delete("/api/cart/items/4")
    assert deleted.json() == {"items": [], "totalQuantity": 0, "totalPrice": 0}

    assert (await client.delete("/api/cart/items/4")).status_code == 404
    assert (await client.patch("/api/cart/items/4", json={"quantity": 1})).status_code == 404


async def test_carts_are_separated_by_user(client):
    await login(client, "cart7@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 5, "quantity": 1})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        await login(other, "cart8@pixelmart.test")
        assert (await other.get("/api/cart")).json()["items"] == []
        # 남의 장바구니 항목은 404로 숨김
        assert (await other.delete("/api/cart/items/5")).status_code == 404

    assert len((await client.get("/api/cart")).json()["items"]) == 1
