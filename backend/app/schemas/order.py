from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.models.order import Order, OrderItem, OrderStatusHistory
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut

RecipientName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]

# 화면에 보여 줄 한글 이름 (프론트가 변환표를 따로 만들지 않아도 되게)
STATUS_LABELS = {
    "paid": "주문 완료",
    "preparing": "상품 준비중",
    "shipping": "배송중",
    "delivered": "배송 완료",
    "cancel_requested": "취소 요청",
    "cancelled": "취소 완료",
}


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


class OrderStatusEntryOut(CamelModel):
    """배송 조회 타임라인의 한 줄"""

    status: str
    label: str
    changed_at: datetime

    @classmethod
    def from_model(cls, entry: OrderStatusHistory) -> "OrderStatusEntryOut":
        return cls(status=entry.status, label=STATUS_LABELS[entry.status], changed_at=entry.changed_at)


class OrderDetailOut(OrderOut):
    """주문 상세 = 주문 정보 + 품목 + 배송 타임라인"""

    status_label: str
    timeline: list[OrderStatusEntryOut]

    @classmethod
    def from_model(cls, order: Order) -> "OrderDetailOut":
        base = OrderOut.from_model(order)
        return cls(
            **base.model_dump(),
            status_label=STATUS_LABELS[order.status],
            timeline=[OrderStatusEntryOut.from_model(h) for h in order.history],
        )


class OrderSummaryOut(CamelModel):
    """주문 목록의 한 줄 — 품목 전체 대신 대표 상품만"""

    id: int
    status: str
    status_label: str
    total_price: int
    created_at: datetime
    title: str  # 예: "HP 하트 키캡 외 1건"
    image_url: str
    item_count: int  # 품목 종류 수

    @classmethod
    def from_model(cls, order: Order) -> "OrderSummaryOut":
        first = order.items[0]
        others = len(order.items) - 1
        return cls(
            id=order.id,
            status=order.status,
            status_label=STATUS_LABELS[order.status],
            total_price=order.total_price,
            created_at=order.created_at,
            title=first.product.name + (f" 외 {others}건" if others else ""),
            image_url=first.product.image_url,
            item_count=len(order.items),
        )
