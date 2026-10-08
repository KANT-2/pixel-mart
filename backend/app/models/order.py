from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.product import Product

# 결제가 없으므로 주문은 paid(주문 완료)로 시작한다
ORDER_STATUSES = ("paid", "preparing", "shipping", "delivered", "cancel_requested", "cancelled")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="paid")
    total_price: Mapped[int] = mapped_column(Integer)  # 원 단위
    recipient_name: Mapped[str] = mapped_column(String(50))
    address: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", order_by="OrderItem.id", lazy="selectin", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (CheckConstraint("quantity BETWEEN 1 AND 99", name="quantity_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[int] = mapped_column(Integer)  # 주문 시점 가격 (상품 가격이 바뀌어도 유지)

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(lazy="joined")
