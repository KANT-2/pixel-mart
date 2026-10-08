from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)  # 구글 계정 고유 ID
    nickname: Mapped[str] = mapped_column(String(30))
    avatar_url: Mapped[str | None] = mapped_column(Text)  # 픽셀 아바타 (브라우저에서 변환한 작은 PNG data URL)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
