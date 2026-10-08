"""취소 신청 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine
from app.services.cancellations import (
    AlreadyCancelRequestedError,
    CannotCancelError,
    check_cancellable,
    status_before_cancel,
)

BODY = {"recipientName": "홍길동", "address": "서울시 마포구 픽셀로 8"}


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM cancel_requests LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")
    # 재실행해도 같은 결과가 나오도록 이 테스트 계정의 이전 주문(신청·타임라인 포함)을 지우고 시작
    async with engine.begin() as conn:
        await conn.execute(
            text("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'cancel%@pixelmart.test')")
        )


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")


async def place_order(client: AsyncClient, email: str, advance: int = 0) -> int:
    """로그인 → 주문 → (선택) 배송을 advance번 진행하고 주문 번호를 돌려준다"""
    await login(client, email)
    await client.post("/api/cart/items", json={"productId": 1, "quantity": 1})
    order_id = (await client.post("/api/orders", json=BODY)).json()["id"]
    for _ in range(advance):
        await client.post(f"/api/dev/orders/{order_id}/advance")
    return order_id


async def request_cancel(client: AsyncClient, order_id: int, reason: str = "단순 변심"):
    return await client.post(f"/api/orders/{order_id}/cancel-requests", json={"reason": reason})


async def order_detail(client: AsyncClient, order_id: int) -> dict:
    return (await client.get(f"/api/orders/{order_id}")).json()


# ---- 순수 함수 (DB 없이) ----
@pytest.mark.parametrize("status", ["paid", "preparing"])
def test_check_cancellable_allows_before_shipping(status):
    check_cancellable(status)


@pytest.mark.parametrize("status", ["shipping", "delivered", "unknown"])
def test_check_cancellable_rejects_after_shipping(status):
    with pytest.raises(CannotCancelError):
        check_cancellable(status)


@pytest.mark.parametrize("status", ["cancel_requested", "cancelled"])
def test_check_cancellable_rejects_duplicates(status):
    with pytest.raises(AlreadyCancelRequestedError):
        check_cancellable(status)


def test_status_before_cancel_finds_last_normal_status():
    assert status_before_cancel(["paid", "preparing", "cancel_requested"]) == "preparing"
    assert status_before_cancel(["paid", "cancel_requested", "paid", "cancel_requested"]) == "paid"


def test_status_before_cancel_without_history_raises():
    with pytest.raises(ValueError):
        status_before_cancel(["cancel_requested"])


# ---- 신청 ----
async def test_cancel_request_requires_login(client):
    assert (await request_cancel(client, 1)).status_code == 401


async def test_cancel_request_marks_order_and_timeline(client):
    order_id = await place_order(client, "cancel1@pixelmart.test")
    res = await request_cancel(client, order_id, "  단순 변심 ")
    body = res.json()
    assert res.status_code == 201
    assert body["status"] == "requested"
    assert body["statusLabel"] == "취소 요청중"
    assert body["reason"] == "단순 변심"
    assert body["orderId"] == order_id

    detail = await order_detail(client, order_id)
    assert detail["status"] == "cancel_requested"
    assert [t["status"] for t in detail["timeline"]] == ["paid", "cancel_requested"]


@pytest.mark.parametrize("reason", ["", "   ", "가" * 201])
async def test_invalid_reason_is_422_and_order_untouched(client, reason):
    order_id = await place_order(client, "cancel2@pixelmart.test")
    assert (await request_cancel(client, order_id, reason)).status_code == 422
    assert (await order_detail(client, order_id))["status"] == "paid"


async def test_cancel_request_in_preparing_is_allowed(client):
    order_id = await place_order(client, "cancel3@pixelmart.test", advance=1)
    assert (await request_cancel(client, order_id)).status_code == 201


@pytest.mark.parametrize("advance", [2, 3])
async def test_cancel_request_after_shipping_is_400(client, advance):
    order_id = await place_order(client, "cancel4@pixelmart.test", advance=advance)
    res = await request_cancel(client, order_id)
    assert res.status_code == 400
    assert res.json()["detail"] == "배송이 시작된 주문은 취소할 수 없습니다."


async def test_duplicate_cancel_request_is_400(client):
    order_id = await place_order(client, "cancel5@pixelmart.test")
    await request_cancel(client, order_id)
    res = await request_cancel(client, order_id)
    assert res.status_code == 400
    count = await _count_requests(order_id)
    assert count == 1


async def test_cancel_other_users_order_is_404(client):
    order_id = await place_order(client, "cancel6@pixelmart.test")
    await login(client, "cancel7@pixelmart.test")
    assert (await request_cancel(client, order_id)).status_code == 404
    await login(client, "cancel6@pixelmart.test")  # 남의 주문은 그대로여야 한다
    assert (await order_detail(client, order_id))["status"] == "paid"


async def test_cancel_unknown_order_is_404(client):
    await login(client, "cancel6@pixelmart.test")
    assert (await request_cancel(client, 999999)).status_code == 404


# ---- 승인 · 거절 (로컬 전용) ----
async def test_approve_cancels_order(client):
    order_id = await place_order(client, "cancel8@pixelmart.test")
    request_id = (await request_cancel(client, order_id)).json()["id"]

    res = await client.post(f"/api/dev/cancel-requests/{request_id}/approve")
    assert res.status_code == 200
    assert res.json()["status"] == "approved"

    detail = await order_detail(client, order_id)
    assert detail["status"] == "cancelled"
    assert detail["statusLabel"] == "취소 완료"
    assert [t["status"] for t in detail["timeline"]] == ["paid", "cancel_requested", "cancelled"]


async def test_reject_restores_previous_status(client):
    order_id = await place_order(client, "cancel9@pixelmart.test", advance=1)  # preparing
    request_id = (await request_cancel(client, order_id)).json()["id"]

    res = await client.post(f"/api/dev/cancel-requests/{request_id}/reject")
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"

    detail = await order_detail(client, order_id)
    assert detail["status"] == "preparing"
    assert [t["status"] for t in detail["timeline"]] == ["paid", "preparing", "cancel_requested", "preparing"]


async def test_rejected_order_can_request_again_and_keep_flowing(client):
    order_id = await place_order(client, "cancel10@pixelmart.test")
    request_id = (await request_cancel(client, order_id)).json()["id"]
    await client.post(f"/api/dev/cancel-requests/{request_id}/reject")

    assert (await request_cancel(client, order_id, "다시 신청")).status_code == 201
    # 거절된 주문은 배송 진행도 이어진다
    other = await place_order(client, "cancel10@pixelmart.test")
    rid = (await request_cancel(client, other)).json()["id"]
    await client.post(f"/api/dev/cancel-requests/{rid}/reject")
    assert (await client.post(f"/api/dev/orders/{other}/advance")).json()["status"] == "preparing"


async def test_resolved_request_cannot_be_resolved_again(client):
    order_id = await place_order(client, "cancel11@pixelmart.test")
    request_id = (await request_cancel(client, order_id)).json()["id"]
    await client.post(f"/api/dev/cancel-requests/{request_id}/approve")
    for action in ("approve", "reject"):
        res = await client.post(f"/api/dev/cancel-requests/{request_id}/{action}")
        assert res.status_code == 400
    assert (await order_detail(client, order_id))["status"] == "cancelled"


async def test_cancelled_order_cannot_advance(client):
    order_id = await place_order(client, "cancel12@pixelmart.test")
    request_id = (await request_cancel(client, order_id)).json()["id"]
    await client.post(f"/api/dev/cancel-requests/{request_id}/approve")
    assert (await client.post(f"/api/dev/orders/{order_id}/advance")).status_code == 400


async def test_resolve_requires_login(client):
    assert (await client.post("/api/dev/cancel-requests/1/approve")).status_code == 401


async def test_cannot_resolve_other_users_request(client):
    order_id = await place_order(client, "cancel13@pixelmart.test")
    request_id = (await request_cancel(client, order_id)).json()["id"]
    await login(client, "cancel14@pixelmart.test")
    assert (await client.post(f"/api/dev/cancel-requests/{request_id}/approve")).status_code == 404
    await login(client, "cancel13@pixelmart.test")
    assert (await order_detail(client, order_id))["status"] == "cancel_requested"


async def test_resolve_is_404_when_not_local(client, monkeypatch):
    order_id = await place_order(client, "cancel15@pixelmart.test")
    request_id = (await request_cancel(client, order_id)).json()["id"]
    monkeypatch.setattr(settings, "env", "production")
    assert (await client.post(f"/api/dev/cancel-requests/{request_id}/approve")).status_code == 404


async def _count_requests(order_id: int) -> int:
    async with engine.connect() as conn:
        return await conn.scalar(text("SELECT count(*) FROM cancel_requests WHERE order_id = :id"), {"id": order_id})
