from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.local import TradePost

# 신청 pending → 글 주인이 수락(accepted)·거절(declined), 신청한 사람이 취소(cancelled)
TRADE_REQUEST_STATUSES = ("pending", "accepted", "declined", "cancelled")


class TradeRequest(Base):
    """이웃의 거래글에 보내는 교환 신청 — 내 글(offer_post)을 함께 보낼 수 있다"""

    __tablename__ = "trade_requests"
    __table_args__ = (CheckConstraint("status IN ('pending', 'accepted', 'declined', 'cancelled')", name="status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("trade_posts.id", ondelete="CASCADE"), index=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    offer_post_id: Mapped[int | None] = mapped_column(ForeignKey("trade_posts.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(10), default="pending", server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    post: Mapped[TradePost] = relationship(foreign_keys=[post_id], lazy="joined")
    offer_post: Mapped[TradePost | None] = relationship(foreign_keys=[offer_post_id], lazy="joined")
    requester: Mapped["User"] = relationship(lazy="joined")  # noqa: F821
