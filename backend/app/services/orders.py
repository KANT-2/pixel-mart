from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CartItem, Order, OrderItem, User
from app.schemas.order import OrderCreate


class EmptyCartError(Exception):
    """장바구니가 비어 있어 주문할 수 없음"""


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
    )
    db.add(order)
    await db.execute(delete(CartItem).where(CartItem.user_id == user.id))
    await db.commit()

    # id·created_at 같은 DB가 채운 값을 읽어 온다
    return await db.scalar(select(Order).where(Order.id == order.id).execution_options(populate_existing=True))
