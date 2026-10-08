from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CartItem, Order, OrderItem, OrderStatusHistory, User
from app.schemas.order import OrderCreate

# 배송이 진행되는 순서 (취소 흐름은 따로 다룬다)
DELIVERY_FLOW = ("paid", "preparing", "shipping", "delivered")


class EmptyCartError(Exception):
    """장바구니가 비어 있어 주문할 수 없음"""


class CannotAdvanceError(Exception):
    """더 진행할 수 없는 상태 (배송 완료이거나 취소 흐름)"""


def next_status(current: str) -> str:
    """배송 단계의 다음 상태. DB 없이 테스트할 수 있는 순수 함수"""
    if current not in DELIVERY_FLOW or current == DELIVERY_FLOW[-1]:
        raise CannotAdvanceError(current)
    return DELIVERY_FLOW[DELIVERY_FLOW.index(current) + 1]


async def create_order_from_cart(db: AsyncSession, user: User, body: OrderCreate) -> Order:
    """장바구니 전체를 가상 주문으로 만들고 장바구니를 비운다 (한 번의 commit — 실패하면 전부 취소)"""
    cart = (
        await db.scalars(
            select(CartItem).where(CartItem.user_id == user.id).order_by(CartItem.added_at, CartItem.product_id)
        )
    ).all()
    if not cart:
        raise EmptyCartError

    # 주문 시점의 가격을 품목에 복사해 둔다 (이후 상품 가격이 바뀌어도 주문 금액은 그대로)
    items = [OrderItem(product=c.product, quantity=c.quantity, unit_price=c.product.price) for c in cart]
    order = Order(
        user_id=user.id,
        status="paid",
        total_price=sum(i.unit_price * i.quantity for i in items),
        recipient_name=body.recipient_name,
        address=body.address,
        items=items,
        history=[OrderStatusHistory(status="paid")],  # 타임라인의 첫 줄
    )
    db.add(order)
    await db.execute(delete(CartItem).where(CartItem.user_id == user.id))
    await db.commit()

    # id·created_at 같은 DB가 채운 값을 읽어 온다
    return await get_order(db, order.id)


async def get_order(db: AsyncSession, order_id: int) -> Order:
    return await db.scalar(select(Order).where(Order.id == order_id).execution_options(populate_existing=True))


async def get_user_order(db: AsyncSession, user: User, order_id: int) -> Order | None:
    """내 주문만 돌려준다. 남의 주문은 없는 것처럼(None) 숨긴다"""
    order = await db.scalar(
        select(Order).where(Order.id == order_id, Order.user_id == user.id).execution_options(populate_existing=True)
    )
    return order


async def advance_order(db: AsyncSession, order: Order) -> Order:
    """배송을 다음 단계로 넘기고 타임라인에 기록한다 (한 번의 commit)"""
    new_status = next_status(order.status)
    order.status = new_status
    db.add(OrderStatusHistory(order_id=order.id, status=new_status))
    await db.commit()
    return await get_order(db, order.id)
