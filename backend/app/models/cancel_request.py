from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

# 신청 → 승인(주문 취소 완료) 또는 거절(주문이 원래 상태로 복귀)
CANCEL_REQUEST_STATUSES = ("requested", "approved", "rejected")


class CancelRequest(Base):
    __tablename__ = "cancel_requests"
    # 한 주문에 처리 대기 중인 신청은 하나만 — 동시에 두 번 신청해도 DB가 막는다
    __table_args__ = (
        Index(
            "uq_cancel_requests_pending_order", "order_id", unique=True, postgresql_where=text("status = 'requested'")
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="requested")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
