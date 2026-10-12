from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Keyboard(Base):
    """키캡 호환성 확인용 키보드 모델 (Mock 데이터 — 시드로 채운다)"""

    __tablename__ = "keyboards"
    __table_args__ = (UniqueConstraint("maker", "model"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    maker: Mapped[str] = mapped_column(String(50), index=True)
    model: Mapped[str] = mapped_column(String(80))
    layout: Mapped[str] = mapped_column(String(10))  # ANSI / ISO
    stem: Mapped[str] = mapped_column(String(20))  # 스위치 축 방식 (MX, LOW ...)
    profile_support: Mapped[list[str]] = mapped_column(ARRAY(String(20)))  # 지원하는 키캡 프로파일
    esc_size: Mapped[str] = mapped_column(String(10))  # 1u, 1.5u ...
    spacebar_size: Mapped[str] = mapped_column(String(10))  # 6.25u, 7u ...
    has_arrow_cluster: Mapped[bool] = mapped_column(Boolean)  # 방향키 블록이 있는지


class KeycapSpec(Base):
    """키캡 상품 한 개의 규격 — 키캡 카테고리 상품만 가진다"""

    __tablename__ = "keycap_specs"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    profile: Mapped[str] = mapped_column(String(20))  # cherry, metal ...
    stem: Mapped[str] = mapped_column(String(20))
    key_sizes: Mapped[list[str]] = mapped_column(ARRAY(String(20)))  # 1u, 6.25u, arrows, accent4
