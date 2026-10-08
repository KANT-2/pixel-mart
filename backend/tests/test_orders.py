"""주문 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine
from app.services.orders import CannotAdvanceError, next_status

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


async def place_order(client: AsyncClient, email: str, product_ids: tuple[int, ...] = (1,)) -> dict:
    """로그인 → 장바구니에 담기 → 주문하고, 주문 응답을 돌려준다"""
    await login(client, email)
    for product_id in product_ids:
        await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})
    res = await client.post("/api/orders", json=BODY)
    assert res.status_code == 201
    return res.json()


# ---- 순수 함수 (DB 없이) ----
def test_next_status_follows_delivery_flow():
    assert [next_status(s) for s in ("paid", "preparing", "shipping")] == ["preparing", "shipping", "delivered"]


@pytest.mark.parametrize("status", ["delivered", "cancel_requested", "cancelled", "unknown"])
def test_next_status_rejects_non_advanceable(status):
    with pytest.raises(CannotAdvanceError):
        next_status(status)


# ---- 주문 목록 ----
async def test_list_orders_requires_login(client):
    assert (await client.get("/api/orders")).status_code == 401


async def test_list_orders_newest_first_with_summary(client):
    first = await place_order(client, "orders5@pixelmart.test", (1, 2))
    second = await place_order(client, "orders5@pixelmart.test", (3,))

    res = await client.get("/api/orders")
    body = res.json()
    assert res.status_code == 200
    assert body["total"] == 2
    assert [o["id"] for o in body["items"]] == [second["id"], first["id"]]
    assert body["items"][1]["title"].endswith("외 1건")
    assert body["items"][1]["itemCount"] == 2
    assert body["items"][0]["statusLabel"] == "주문 완료"


async def test_list_orders_shows_only_my_orders(client):
    await place_order(client, "orders6@pixelmart.test")
    await login(client, "orders7@pixelmart.test")
    res = await client.get("/api/orders")
    assert res.json()["total"] == 0


async def test_list_orders_rejects_oversized_page(client):
    await login(client, "orders5@pixelmart.test")
    assert (await client.get("/api/orders", params={"size": 100})).status_code == 422


# ---- 주문 상세 · 타임라인 ----
async def test_order_detail_has_initial_timeline(client):
    order = await place_order(client, "orders8@pixelmart.test")
    res = await client.get(f"/api/orders/{order['id']}")
    body = res.json()
    assert res.status_code == 200
    assert body["status"] == "paid"
    assert [t["status"] for t in body["timeline"]] == ["paid"]
    assert body["timeline"][0]["label"] == "주문 완료"
    assert body["items"][0]["unitPrice"] == order["items"][0]["unitPrice"]


async def test_other_users_order_is_404(client):
    order = await place_order(client, "orders9@pixelmart.test")
    await login(client, "orders10@pixelmart.test")
    assert (await client.get(f"/api/orders/{order['id']}")).status_code == 404


async def test_unknown_order_is_404(client):
    await login(client, "orders9@pixelmart.test")
    assert (await client.get("/api/orders/999999")).status_code == 404


# ---- 배송 단계 진행 (로컬 전용) ----
async def test_advance_walks_through_delivery_and_records_timeline(client):
    order = await place_order(client, "orders11@pixelmart.test")
    for expected in ("preparing", "shipping", "delivered"):
        res = await client.post(f"/api/dev/orders/{order['id']}/advance")
        assert res.status_code == 200
        assert res.json()["status"] == expected

    detail = (await client.get(f"/api/orders/{order['id']}")).json()
    assert [t["status"] for t in detail["timeline"]] == ["paid", "preparing", "shipping", "delivered"]
    assert detail["statusLabel"] == "배송 완료"
    times = [t["changedAt"] for t in detail["timeline"]]
    assert times == sorted(times)


async def test_advance_after_delivered_is_400(client):
    order = await place_order(client, "orders12@pixelmart.test")
    for _ in range(3):
        await client.post(f"/api/dev/orders/{order['id']}/advance")
    res = await client.post(f"/api/dev/orders/{order['id']}/advance")
    assert res.status_code == 400


async def test_advance_requires_login(client):
    assert (await client.post("/api/dev/orders/1/advance")).status_code == 401


async def test_cannot_advance_other_users_order(client):
    order = await place_order(client, "orders13@pixelmart.test")
    await login(client, "orders14@pixelmart.test")
    assert (await client.post(f"/api/dev/orders/{order['id']}/advance")).status_code == 404
    # 남의 주문은 그대로여야 한다
    await login(client, "orders13@pixelmart.test")
    assert (await client.get(f"/api/orders/{order['id']}")).json()["status"] == "paid"


async def test_advance_is_404_when_not_local(client, monkeypatch):
    order = await place_order(client, "orders15@pixelmart.test")
    monkeypatch.setattr(settings, "env", "production")
    assert (await client.post(f"/api/dev/orders/{order['id']}/advance")).status_code == 404
