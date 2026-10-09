"""동네 선물 — 거래글 이웃에게 데모 결제로 선물, 받는 사람이 주소를 넣어 받으면 그 사람의 주문

로컬 DB 필요, 없으면 건너뜀
"""

import json
from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app

ZONE = "GFT1-01"
TEST_REGIONS = [
    ("GFT", "sido", None, "선물시"),
    ("GFT1", "sigungu", "GFT", "일구"),
    ("GFT1-01", "zone", "GFT1", "가동"),
]
PRODUCT = 3
ADDRESS = {"recipientName": "받는이", "address": "서울시 픽셀구 선물로 1"}


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

        async def make(email: str) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email, "nickname": email.split("@")[0]})
            await c.put("/api/users/me/local", json={"regionCode": ZONE, "interestIds": []})
            return c

        yield make

    async with engine.begin() as conn:
        ids = "SELECT id FROM users WHERE email LIKE 'gift-%@pixelmart.test'"
        await conn.execute(text(f"DELETE FROM gifts WHERE sender_id IN ({ids}) OR recipient_id IN ({ids})"))
        await conn.execute(text(f"DELETE FROM orders WHERE user_id IN ({ids})"))
        await conn.execute(text("DELETE FROM trade_posts WHERE region_code LIKE 'GFT%'"))
        await conn.execute(text("UPDATE users SET region_code = NULL WHERE region_code LIKE 'GFT%'"))
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'GFT%' AND level = :l"), {"l": level})


async def want_post(c: AsyncClient, name: str = "보물상자 소품함") -> int:
    res = await c.post("/api/local/trades", json={"kind": "want", "itemName": name, "productId": PRODUCT})
    assert res.status_code == 201, res.text
    return res.json()["id"]


def gift(post_id: int, **extra) -> dict:
    return {"tradePostId": post_id, "productId": PRODUCT, "message": "잘 쓰세요!"} | extra


async def test_send_requires_login(client):
    assert (await client.post("/api/gifts", json=gift(1))).status_code == 401


async def test_send_and_both_boxes_stay_anonymous(users):
    recipient = await users("gift-recipient@pixelmart.test")
    sender = await users("gift-sender@pixelmart.test")
    post_id = await want_post(recipient)

    res = await sender.post("/api/gifts", json=gift(post_id, quantity=2))
    assert res.status_code == 201
    sent = res.json()
    assert sent["box"] == "sent" and sent["status"] == "pending" and sent["counterpart"] == "이웃 플레이어"
    assert sent["quantity"] == 2 and sent["totalPrice"] == sent["product"]["price"] * 2
    assert "gift-recipient" not in json.dumps(sent) and "GFT" not in json.dumps(sent)

    received = (await recipient.get("/api/gifts", params={"box": "received"})).json()
    assert [(g["id"], g["statusLabel"], g["message"]) for g in received] == [(sent["id"], "받기 대기", "잘 쓰세요!")]
    assert "gift-sender" not in json.dumps(received)
    assert (await sender.get("/api/gifts", params={"box": "received"})).json() == []


@pytest.mark.parametrize(
    ("setup", "body_patch", "status"),
    [
        ("own", {}, 400),
        ("have", {}, 400),
        ("sample", {}, 400),
        ("hidden", {}, 404),
        ("open", {"productId": 999999}, 400),  # 구하는 상품이 아님
        ("open", {"productId": PRODUCT + 1}, 400),
        ("no-product", {}, 400),
        ("open", {"message": "010-1234-5678로 연락 주세요"}, 422),
        ("open", {"quantity": 0}, 422),
        ("open", {"quantity": 10}, 422),
    ],
)
async def test_send_rules(users, setup, body_patch, status):
    recipient = await users("gift-recipient@pixelmart.test")
    sender = await users("gift-sender@pixelmart.test")
    post_id = await want_post(sender if setup == "own" else recipient)
    if setup == "no-product":
        async with engine.begin() as conn:
            await conn.execute(text("UPDATE trade_posts SET product_id = NULL WHERE id = :i"), {"i": post_id})
    if setup == "have":
        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE trade_posts SET kind = 'have', condition = 'new' WHERE id = :i"), {"i": post_id}
            )
    if setup == "sample":
        async with engine.begin() as conn:
            await conn.execute(text("UPDATE trade_posts SET is_sample = true WHERE id = :i"), {"i": post_id})
    if setup == "hidden":
        await recipient.patch(f"/api/local/trades/{post_id}", json={"status": "hidden"})
    res = await sender.post("/api/gifts", json=gift(post_id) | body_patch)
    assert res.status_code == status


async def test_accept_creates_recipients_order_and_hides_address_from_sender(users):
    recipient = await users("gift-recipient@pixelmart.test")
    sender = await users("gift-sender@pixelmart.test")
    stranger = await users("gift-stranger@pixelmart.test")
    gift_id = (await sender.post("/api/gifts", json=gift(await want_post(recipient)))).json()["id"]

    assert (await stranger.post(f"/api/gifts/{gift_id}/accept", json=ADDRESS)).status_code == 404  # 남의 선물
    assert (await sender.post(f"/api/gifts/{gift_id}/accept", json=ADDRESS)).status_code == 404  # 보낸 사람도 못 받음

    res = await recipient.post(f"/api/gifts/{gift_id}/accept", json=ADDRESS)
    assert res.status_code == 200
    accepted = res.json()
    assert accepted["status"] == "accepted" and accepted["orderId"]

    order = (await recipient.get(f"/api/orders/{accepted['orderId']}")).json()
    assert order["address"] == ADDRESS["address"] and order["status"] == "paid"
    assert [(i["product"]["id"], i["quantity"]) for i in order["items"]] == [(PRODUCT, 1)]

    sent = (await sender.get("/api/gifts", params={"box": "sent"})).json()
    assert sent[0]["statusLabel"] == "받았어요" and sent[0]["orderId"] is None
    assert ADDRESS["address"] not in json.dumps(sent) and "받는이" not in json.dumps(sent)
    assert (await recipient.post(f"/api/gifts/{gift_id}/accept", json=ADDRESS)).status_code == 400  # 두 번 못 받음


async def test_decline_shows_refund_to_sender(users):
    recipient = await users("gift-recipient@pixelmart.test")
    sender = await users("gift-sender@pixelmart.test")
    gift_id = (await sender.post("/api/gifts", json=gift(await want_post(recipient)))).json()["id"]
    res = await recipient.post(f"/api/gifts/{gift_id}/decline")
    assert res.status_code == 200 and res.json()["status"] == "declined"
    assert (await sender.get("/api/gifts", params={"box": "sent"})).json()[0]["statusLabel"] == "거절 · 환불(데모)"
    assert (await recipient.post(f"/api/gifts/{gift_id}/decline")).status_code == 400


async def test_accept_validates_address(users):
    recipient = await users("gift-recipient@pixelmart.test")
    sender = await users("gift-sender@pixelmart.test")
    gift_id = (await sender.post("/api/gifts", json=gift(await want_post(recipient)))).json()["id"]
    assert (
        await recipient.post(f"/api/gifts/{gift_id}/accept", json={"recipientName": "", "address": "x"})
    ).status_code == 422
