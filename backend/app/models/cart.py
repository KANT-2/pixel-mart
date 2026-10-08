from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.product import Product


class CartItem(Base):
    __tablename__ = "cart_items"
    # ck 이름 규칙(ck_%(table_name)s_%(constraint_name)s)에 들어갈 짧은 이름만 지정
    __table_args__ = (CheckConstraint("quantity BETWEEN 1 AND 99", name="quantity_range"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    quantity: Mapped[int] = mapped_column(Integer)
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product] = relationship(lazy="joined")
