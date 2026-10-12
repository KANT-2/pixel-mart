from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ActivityPoint(Base):
    """PIXEL LOCAL 활동 점수 기록 — 하트(지역 커뮤니티 참여도)와 코인(완료한 교환·거래)의 근거.

    같은 일(kind + ref_id)은 한 번만 적립한다. 한 번만 받는 활동은 ref_id 0.
    """

    __tablename__ = "activity_points"
    __table_args__ = (UniqueConstraint("user_id", "kind", "ref_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    ref_id: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # 거래글·선물 id
    points: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
