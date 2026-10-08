"""거래·교환 규칙 (PIXEL LOCAL 운영정책 11~13장) — 연락처·정확한 장소 금지, HAVE/WANT + 같은 지역 매칭"""

import re
from typing import Protocol

FORBIDDEN_PATTERNS = [
    re.compile(r"01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}"),  # 휴대폰 번호
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),  # 이메일
    re.compile(r"open\.kakao\.com|(카톡|카카오톡)\s*아이디|오픈\s*채팅", re.IGNORECASE),
    re.compile(r"\d+\s*동\s*\d+\s*호|\d+\s*번지"),  # 아파트 동·호수, 지번
]


def contains_private_info(*texts: str) -> bool:
    return any(p.search(t) for t in texts for p in FORBIDDEN_PATTERNS)


class TradeItem(Protocol):
    product_id: int | None
    interest_id: int | None
    item_name: str


def normalize(name: str) -> str:
    return re.sub(r"\s+", "", name).lower()


def same_item(a: TradeItem, b: TradeItem) -> bool:
    """같은 상품 → 같은 취향 태그(예: 오로치마루) → 같은 물건 이름 순으로 하나라도 맞으면 같은 물건"""
    if a.product_id is not None and a.product_id == b.product_id:
        return True
    if a.interest_id is not None and a.interest_id == b.interest_id:
        return True
    return normalize(a.item_name) == normalize(b.item_name)
