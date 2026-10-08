from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbSession
from app.schemas.order import OrderCreate, OrderOut
from app.services.orders import EmptyCartError, create_order_from_cart

router = APIRouter(prefix="/orders", tags=["orders"])


@router.post(
    "", response_model=OrderOut, status_code=status.HTTP_201_CREATED, summary="장바구니로 가상 주문 (결제 없음)"
)
async def create_order(body: OrderCreate, user: CurrentUser, db: DbSession):
    try:
        order = await create_order_from_cart(db, user, body)
    except EmptyCartError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "장바구니가 비어 있습니다.") from None
    return OrderOut.from_model(order)
