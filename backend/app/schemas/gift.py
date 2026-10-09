from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.models.gift import Gift
from app.schemas.common import CamelModel
from app.schemas.product import ProductOut

RECEIVED_LABELS = {"pending": "받기 대기", "accepted": "받음", "declined": "거절함"}
SENT_LABELS = {"pending": "받기 대기", "accepted": "받았어요", "declined": "거절 · 환불(데모)"}


class GiftIn(CamelModel):
    """거래글을 올린 이웃에게 선물 — 결제는 데모(실제 결제 없음)"""

    trade_post_id: int
    product_id: int
    quantity: Annotated[int, Field(ge=1, le=9)] = 1
    message: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""


class GiftOut(CamelModel):
    """선물 한 건 — 상대는 항상 "이웃 플레이어", 닉네임·계정·주소는 담지 않는다"""

    id: int
    box: Literal["sent", "received"]
    status: str
    status_label: str
    product: ProductOut
    quantity: int
    total_price: int
    message: str
    counterpart: str = "이웃 플레이어"
    order_id: int | None = Field(default=None, description="받은 선물을 받으면 생기는 내 주문 id (받는 사람에게만)")
    created_at: datetime

    @classmethod
    def from_model(cls, gift: Gift, box: Literal["sent", "received"]) -> "GiftOut":
        return cls(
            id=gift.id,
            box=box,
            status=gift.status,
            status_label=(SENT_LABELS if box == "sent" else RECEIVED_LABELS)[gift.status],
            product=ProductOut.from_model(gift.product),
            quantity=gift.quantity,
            total_price=gift.unit_price * gift.quantity,
            message=gift.message,
            order_id=gift.order_id if box == "received" else None,
            created_at=gift.created_at,
        )
