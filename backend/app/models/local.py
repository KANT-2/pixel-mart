"""PIXEL LOCAL — 지역(시 › 구 › 동·생활권)과 취향 태그. GPS·주소는 저장하지 않는다"""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Region(Base):
    __tablename__ = "regions"
    __table_args__ = (CheckConstraint("level IN ('sido', 'sigungu', 'zone')", name="level"),)

    code: Mapped[str] = mapped_column(String(12), primary_key=True)  # 행정구역 코드, 생활권은 "구코드-번호"
    level: Mapped[str] = mapped_column(String(10))
    parent_code: Mapped[str | None] = mapped_column(ForeignKey("regions.code"), index=True)
    name: Mapped[str] = mapped_column(String(40))


class Interest(Base):
    """작품 > 캐릭터 계층의 텍스트 태그 (공식 이미지·로고는 다루지 않음)"""

    __tablename__ = "interests"
    __table_args__ = (CheckConstraint("type IN ('work', 'character', 'style', 'product_type')", name="type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(50))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("interests.id", ondelete="SET NULL"))


class UserInterest(Base):
    __tablename__ = "user_interests"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    interest_id: Mapped[int] = mapped_column(
        ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    # 덕력지도 집계 기간(최근 30일·90일) 필터용 — 취향을 고른 시각
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
