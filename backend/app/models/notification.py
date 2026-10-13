from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Notification(Base):
    """앱 안 알림 (종 모양 아이콘). 같은 일(kind + ref_key)은 한 사람에게 한 번만 쌓인다."""

    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "kind", "ref_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(String(200))
    href: Mapped[str | None] = mapped_column(String(200))  # 프론트 내부 경로만
    ref_key: Mapped[str] = mapped_column(String(120), default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
