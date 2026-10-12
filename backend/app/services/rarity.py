"""상품 아이템 등급 (COMMON · RARE · EPIC · UNIQUE) — 가격대로 정한다

프론트 utils/gameItem.ts 의 rarityOf와 같은 기준이다. 기준을 바꾸면 두 곳을 함께 바꾼다.
"""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import and_
from sqlalchemy.sql.elements import ColumnElement

from app.models import Product

Rarity = Literal["common", "rare", "epic", "unique"]


@dataclass(frozen=True)
class RarityTier:
    key: Rarity
    label: str
    min_price: int  # 포함
    max_price: int | None  # 미포함, 마지막 등급은 상한 없음


TIERS: tuple[RarityTier, ...] = (
    RarityTier("common", "COMMON", 0, 10_000),
    RarityTier("rare", "RARE", 10_000, 20_000),
    RarityTier("epic", "EPIC", 20_000, 30_000),
    RarityTier("unique", "UNIQUE", 30_000, None),
)
BY_KEY: dict[str, RarityTier] = {t.key: t for t in TIERS}


def rarity_of(price: int) -> Rarity:
    for tier in TIERS:
        if tier.max_price is None or price < tier.max_price:
            return tier.key
    return TIERS[-1].key


def price_condition(tier: RarityTier) -> ColumnElement[bool]:
    """그 등급에 드는 상품 가격 조건 (SQL)"""
    lower = Product.price >= tier.min_price
    return lower if tier.max_price is None else and_(lower, Product.price < tier.max_price)
