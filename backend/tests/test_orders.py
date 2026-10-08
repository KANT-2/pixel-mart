"""주문 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.db import engine

BODY = {"recipientName": "홍길동", "address": "서울시 마포구 픽셀로 8"}


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM orders LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")
    # 재실행해도 같은 결과가 나오도록 이 테스트 계정의 이전 주문을 지우고 시작
    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'orders%@pixelmart.test')")
        )


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")


async def test_create_order_requires_login(client):
    res = await client.post("/api/orders", json=BODY)
    assert res.status_code == 401


async def test_empty_cart_is_400(client):
    await login(client, "orders1@pixelmart.test")
    res = await client.post("/api/orders", json=BODY)
    assert res.status_code == 400
    assert res.json()["detail"] == "장바구니가 비어 있습니다."


@pytest.mark.parametrize(
    "body",
    [
        {"recipientName": "", "address": "서울"},
        {"recipientName": "   ", "address": "서울"},
        {"recipientName": "홍길동", "address": ""},
        {"recipientName": "홍길동"},
    ],
)
async def test_invalid_recipient_is_422(client, body):
    await login(client, "orders2@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 1, "quantity": 1})
    res = await client.post("/api/orders", json=body)
    assert res.status_code == 422
    # 실패한 주문은 장바구니를 건드리지 않는다
    assert (await client.get("/api/cart")).json()["totalQuantity"] == 1


async def test_create_order_from_cart_and_empty_it(client):
    await login(client, "orders3@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 1, "quantity": 2})
    await client.post("/api/cart/items", json={"productId": 2, "quantity": 1})
    price1 = (await client.get("/api/products/1")).json()["price"]
    price2 = (await client.get("/api/products/2")).json()["price"]

    res = await client.post("/api/orders", json=BODY)
    order = res.json()
    assert res.status_code == 201
    assert order["status"] == "paid"
    assert order["totalPrice"] == price1 * 2 + price2
    assert order["recipientName"] == "홍길동"
    assert [(i["product"]["id"], i["quantity"], i["unitPrice"]) for i in order["items"]] == [
        (1, 2, price1),
        (2, 1, price2),
    ]
    assert (await client.get("/api/cart")).json()["totalQuantity"] == 0


async def test_order_keeps_price_when_product_price_changes(client):
    await login(client, "orders4@pixelmart.test")
    await client.post("/api/cart/items", json={"productId": 1, "quantity": 1})
    price = (await client.get("/api/products/1")).json()["price"]
    order_id = (await client.post("/api/orders", json=BODY)).json()["id"]

    try:
        async with engine.begin() as conn:
            await conn.execute(text("UPDATE products SET price = price + 1000 WHERE id = 1"))
        async with engine.connect() as conn:
            saved = await conn.scalar(text("SELECT unit_price FROM order_items WHERE order_id = :id"), {"id": order_id})
    finally:
        async with engine.begin() as conn:  # 다른 테스트에 영향이 없게 원래 가격으로 복구
            await conn.execute(text("UPDATE products SET price = :p WHERE id = 1"), {"p": price})

    assert saved == price
