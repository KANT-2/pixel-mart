from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, false, func
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
    # PIXEL LOCAL: 지역은 사용자가 직접 고른 시·구·생활권만. 집계 참여와 취향 공개는 각각 opt-in
    region_code: Mapped[str | None] = mapped_column(ForeignKey("regions.code"), index=True)
    fandom_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    profile_public: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
