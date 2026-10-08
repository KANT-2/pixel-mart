"""지역 계층(시 › 구 › 동·생활권) 계산 — 지역 수가 적어 전체를 읽어 파이썬에서 계산한다"""

from collections.abc import Iterable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Region


@dataclass(frozen=True)
class RegionTree:
    by_code: dict[str, Region]

    def ancestors(self, code: str) -> list[str]:
        """자기 자신부터 시까지 (예: 판교 → 분당구 → 성남시)"""
        chain = []
        current: str | None = code
        while current is not None and current in self.by_code:
            chain.append(current)
            current = self.by_code[current].parent_code
        return chain

    def full_name(self, code: str) -> str:
        return " ".join(self.by_code[c].name for c in reversed(self.ancestors(code)))

    def district_of(self, code: str) -> str | None:
        """구 단위 코드 (생활권이면 부모 구, 구면 자기 자신, 시면 None) — "같은 구" 판단용"""
        for c in self.ancestors(code):
            if self.by_code[c].level == "sigungu":
                return c
        return None


def build_tree(regions: Iterable[Region]) -> RegionTree:
    return RegionTree(by_code={r.code: r for r in regions})


async def load_tree(db: AsyncSession) -> RegionTree:
    return build_tree(await db.scalars(select(Region)))
