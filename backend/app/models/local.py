"""PIXEL LOCAL — 지역(시 › 구 › 동·생활권)과 취향 태그. GPS·주소는 저장하지 않는다"""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.models.product import Product


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


class FandomSample(Base):
    """Cold Start용 Mock 집계 — 실제 사용자 데이터가 없는 칸만 채우고 응답에 isSample로 표시"""

    __tablename__ = "fandom_samples"
    __table_args__ = (CheckConstraint("count >= 0", name="count"),)

    region_code: Mapped[str] = mapped_column(ForeignKey("regions.code", ondelete="CASCADE"), primary_key=True)
    interest_id: Mapped[int] = mapped_column(ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)


class WishSample(Base):
    """Cold Start용 Mock 찜 집계 — Wish Map에서 실제 찜 데이터가 없는 칸만 채우고 isSample로 표시"""

    __tablename__ = "wish_samples"
    __table_args__ = (CheckConstraint("count >= 0", name="count"),)

    region_code: Mapped[str] = mapped_column(ForeignKey("regions.code", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    count: Mapped[int] = mapped_column(Integer)


class TradePost(Base):
    """거래(sell)·교환(have/want) 글 — 연락처·정확한 장소는 남기지 않고 당사자끼리 정한다 (Prototype)"""

    __tablename__ = "trade_posts"
    __table_args__ = (
        CheckConstraint("kind IN ('have', 'want', 'sell')", name="kind"),
        CheckConstraint("condition IN ('new', 'like_new', 'used')", name="condition"),
        CheckConstraint("trade_method IN ('direct', 'delivery', 'both')", name="trade_method"),
        CheckConstraint("status IN ('open', 'done', 'hidden')", name="status"),
        CheckConstraint("price >= 0", name="price"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    region_code: Mapped[str] = mapped_column(ForeignKey("regions.code"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), index=True)
    interest_id: Mapped[int | None] = mapped_column(ForeignKey("interests.id", ondelete="SET NULL"), index=True)
    item_name: Mapped[str] = mapped_column(String(60))
    condition: Mapped[str | None] = mapped_column(String(10))
    price: Mapped[int | None] = mapped_column(Integer)
    trade_method: Mapped[str] = mapped_column(String(10), default="direct")
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="open", server_default="open")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped[Product | None] = relationship(lazy="joined")
    interest: Mapped[Interest | None] = relationship(lazy="joined")
    # 위시맵 닉네임 공개(opt-in) 판단용 — 응답에는 동의한 경우의 닉네임·아바타만 나간다
    author: Mapped["User"] = relationship(lazy="joined")  # noqa: F821
