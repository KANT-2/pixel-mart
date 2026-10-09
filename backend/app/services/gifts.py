"""동네 선물 — 거래글을 올린 이웃에게 데모 결제로 선물하고, 받는 사람이 주소를 넣어 받으면 그 사람의 주문이 된다.

선물함에서 보낸 사람·받는 사람은 서로를 "이웃 플레이어"로만 본다 (계정·주소 비공개).
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Gift, Order, OrderItem, OrderStatusHistory, Product, TradePost, User
from app.schemas.order import OrderCreate
from app.services.trade_rules import contains_private_info


class GiftError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


async def send_gift(
    db: AsyncSession, sender: User, trade_post_id: int, product_id: int, quantity: int, message: str
) -> Gift:
    post = await db.get(TradePost, trade_post_id)
    if post is None or post.status != "open":
        raise GiftError(404, "선물할 수 있는 거래글을 찾을 수 없습니다.")
    if post.kind != "want":
        raise GiftError(400, "구하는 글(WANT)에만 선물할 수 있습니다.")
    if post.user_id == sender.id:
        raise GiftError(400, "내 글에는 선물할 수 없습니다.")
    if post.is_sample:
        raise GiftError(400, "샘플 글에는 선물할 수 없습니다.")
    # 선물은 이웃이 위시한 PIXEL MART 상품 그대로만 (상품이 연결되지 않은 글에는 선물할 수 없다)
    if post.product_id is None:
        raise GiftError(400, "PIXEL MART 상품을 구하는 글에만 선물할 수 있습니다.")
    if product_id != post.product_id:
        raise GiftError(400, "이웃이 구하는 상품만 선물할 수 있습니다.")
    product = await db.get(Product, product_id)
    if product is None:
        raise GiftError(404, "상품을 찾을 수 없습니다.")
    if contains_private_info(message):
        raise GiftError(422, "선물 메시지에 연락처나 정확한 장소는 적을 수 없습니다.")
    # 결제는 데모 — 결제 시점 가격을 남긴다
    gift = Gift(
        sender_id=sender.id,
        recipient_id=post.user_id,
        trade_post_id=post.id,
        product_id=product.id,
        quantity=quantity,
        unit_price=product.price,
        message=message,
    )
    db.add(gift)
    await db.commit()
    return await get_gift(db, gift.id)


async def get_gift(db: AsyncSession, gift_id: int) -> Gift:
    return await db.scalar(select(Gift).where(Gift.id == gift_id).execution_options(populate_existing=True))


async def list_gifts(db: AsyncSession, user: User, box: str) -> list[Gift]:
    column = Gift.sender_id if box == "sent" else Gift.recipient_id
    rows = await db.scalars(select(Gift).where(column == user.id).order_by(Gift.created_at.desc(), Gift.id.desc()))
    return list(rows)


async def _received(db: AsyncSession, user: User, gift_id: int) -> Gift:
    gift = await db.get(Gift, gift_id)
    if gift is None or gift.recipient_id != user.id:  # 남의 선물은 없는 것처럼
        raise GiftError(404, "선물을 찾을 수 없습니다.")
    if gift.status != "pending":
        raise GiftError(400, "이미 받거나 거절한 선물입니다.")
    return gift


async def accept_gift(db: AsyncSession, user: User, gift_id: int, body: OrderCreate) -> Gift:
    """받는 사람이 직접 입력한 주소로 그 사람의 주문을 만든다 (보낸 사람에게는 주소가 보이지 않음)"""
    gift = await _received(db, user, gift_id)
    order = Order(
        user_id=user.id,
        status="paid",
        total_price=gift.unit_price * gift.quantity,
        recipient_name=body.recipient_name,
        address=body.address,
        items=[OrderItem(product_id=gift.product_id, quantity=gift.quantity, unit_price=gift.unit_price)],
        history=[OrderStatusHistory(status="paid")],
    )
    db.add(order)
    await db.flush()
    gift.order_id = order.id
    gift.status = "accepted"
    gift.responded_at = datetime.now(UTC)
    await db.commit()
    return await get_gift(db, gift.id)


async def decline_gift(db: AsyncSession, user: User, gift_id: int) -> Gift:
    gift = await _received(db, user, gift_id)
    gift.status = "declined"  # 보낸 사람에게는 데모 환불로 보인다
    gift.responded_at = datetime.now(UTC)
    await db.commit()
    return await get_gift(db, gift.id)
