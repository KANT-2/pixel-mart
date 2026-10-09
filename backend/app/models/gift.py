from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.order import Order
from app.models.product import Product

# 보낸 사람이 데모 결제를 하면 pending → 받는 사람이 주소를 넣고 받으면 accepted(주문 생성)
# / 거절하면 declined(데모 환불)
GIFT_STATUSES = ("pending", "accepted", "declined")


class Gift(Base):
    """동네 거래글을 올린 이웃에게 보내는 선물 — 서로의 닉네임·주소는 상대에게 보이지 않는다"""

    __tablename__ = "gifts"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'accepted', 'declined')", name="status"),
        CheckConstraint("quantity BETWEEN 1 AND 9", name="quantity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    trade_post_id: Mapped[int | None] = mapped_column(ForeignKey("trade_posts.id", ondelete="SET NULL"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[int] = mapped_column(Integer)  # 결제 시점 가격
    message: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(10), default="pending", server_default="pending")
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))  # 받는 사람의 주문
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    product: Mapped[Product] = relationship(lazy="joined")
    order: Mapped[Order | None] = relationship(lazy="joined")
