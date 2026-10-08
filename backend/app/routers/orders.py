from math import ceil
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.core.config import settings
from app.deps import CurrentUser, DbSession
from app.models import Order
from app.schemas.common import Page
from app.schemas.order import OrderCreate, OrderDetailOut, OrderOut, OrderSummaryOut
from app.services.orders import (
    CannotAdvanceError,
    EmptyCartError,
    advance_order,
    create_order_from_cart,
    get_user_order,
)

router = APIRouter(prefix="/orders", tags=["orders"])
dev_router = APIRouter(prefix="/dev/orders", tags=["dev"])


@router.post(
    "", response_model=OrderOut, status_code=status.HTTP_201_CREATED, summary="장바구니로 가상 주문 (결제 없음)"
)
async def create_order(body: OrderCreate, user: CurrentUser, db: DbSession):
    try:
        order = await create_order_from_cart(db, user, body)
    except EmptyCartError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "장바구니가 비어 있습니다.") from None
    return OrderOut.from_model(order)


@router.get("", response_model=Page[OrderSummaryOut], summary="내 주문 목록 (최신순)")
async def list_orders(
    user: CurrentUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
):
    total = await db.scalar(select(func.count()).select_from(Order).where(Order.user_id == user.id)) or 0
    rows = await db.scalars(
        select(Order)
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return Page[OrderSummaryOut](
        items=[OrderSummaryOut.from_model(o) for o in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/{order_id}", response_model=OrderDetailOut, summary="주문 상세 + 배송 타임라인")
async def get_order_detail(order_id: int, user: CurrentUser, db: DbSession):
    order = await get_user_order(db, user, order_id)
    if order is None:  # 남의 주문도 같은 404로 숨긴다
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없습니다.")
    return OrderDetailOut.from_model(order)


@dev_router.post("/{order_id}/advance", response_model=OrderDetailOut, summary="[로컬 전용] 배송 단계 진행")
async def advance_delivery(order_id: int, user: CurrentUser, db: DbSession):
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    order = await get_user_order(db, user, order_id)
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "주문을 찾을 수 없습니다.")
    try:
        order = await advance_order(db, order)
    except CannotAdvanceError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "더 진행할 수 없는 주문입니다.") from None
    return OrderDetailOut.from_model(order)
