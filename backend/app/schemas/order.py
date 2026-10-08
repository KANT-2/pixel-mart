from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.models.order import Order, OrderItem
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut

RecipientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class OrderCreate(CamelModel):
    """장바구니 전체를 주문한다 — 받는 사람 정보만 받는다 (결제 없음)"""

    recipient_name: RecipientName
    address: Address


class OrderItemOut(CamelModel):
    product: ProductOut
    quantity: int
    unit_price: int  # 주문 시점 가격
    subtotal: int

    @classmethod
    def from_model(cls, item: OrderItem) -> "OrderItemOut":
        return cls(
            product=ProductOut.from_model(item.product),
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.unit_price * item.quantity,
        )


class OrderOut(CamelModel):
    id: int
    status: str
    total_price: int
    recipient_name: str
    address: str
    created_at: datetime
    items: list[OrderItemOut]

    @classmethod
    def from_model(cls, order: Order) -> "OrderOut":
        return cls(
            id=order.id,
            status=order.status,
            total_price=order.total_price,
            recipient_name=order.recipient_name,
            address=order.address,
            created_at=order.created_at,
            items=[OrderItemOut.from_model(i) for i in order.items],
        )
