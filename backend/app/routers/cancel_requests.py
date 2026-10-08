from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.deps import CurrentUser, DbSession
from app.schemas.cancel_request import CancelRequestIn, CancelRequestOut
from app.services.cancellations import (
    AlreadyCancelRequestedError,
    CannotCancelError,
    NotPendingError,
    get_user_cancel_request,
    request_cancel,
    resolve_cancel,
)
from app.services.orders import get_user_order

router = APIRouter(tags=["orders"])
dev_router = APIRouter(prefix="/dev/cancel-requests", tags=["dev"])


@router.post(
    "/orders/{order_id}/cancel-requests",
    response_model=CancelRequestOut,
    status_code=status.HTTP_201_CREATED,
    summary="취소 신청 (배송 전만)",
)
async def create_cancel_request(order_id: int, body: CancelRequestIn, user: CurrentUser, db: DbSession):
    order = await get_user_order(db, user, order_id)
    if order is None:  # 남의 주문도 같은 404로 숨긴다
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없습니다.")
    try:
        request = await request_cancel(db, order, body.reason)
    except CannotCancelError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "배송이 시작된 주문은 취소할 수 없습니다.") from None
    except AlreadyCancelRequestedError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 취소를 신청했거나 취소된 주문입니다.") from None
    return CancelRequestOut.from_model(request)


async def _resolve(request_id: int, user: CurrentUser, db: DbSession, *, approve: bool) -> CancelRequestOut:
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    request = await get_user_cancel_request(db, user, request_id)
    if request is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "취소 신청을 찾을 수 없습니다.")
    try:
        request = await resolve_cancel(db, request, approve=approve)
    except NotPendingError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 처리된 취소 신청입니다.") from None
    return CancelRequestOut.from_model(request)


@dev_router.post("/{request_id}/approve", response_model=CancelRequestOut, summary="[로컬 전용] 취소 승인")
async def approve_cancel_request(request_id: int, user: CurrentUser, db: DbSession):
    return await _resolve(request_id, user, db, approve=True)


@dev_router.post("/{request_id}/reject", response_model=CancelRequestOut, summary="[로컬 전용] 취소 거절")
async def reject_cancel_request(request_id: int, user: CurrentUser, db: DbSession):
    return await _resolve(request_id, user, db, approve=False)
