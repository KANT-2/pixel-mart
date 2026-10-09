"""닉네임은 대소문자 구분 없이 하나뿐 — 겹치면 자동으로 바꾸지 않고, 사용자가 고를 추천안을 준다"""

import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

MAX_LENGTH = 30
TAKEN_MESSAGE = "이미 사용 중인 닉네임입니다."


async def is_taken(db: AsyncSession, nickname: str, except_user_id: int | None = None) -> bool:
    query = select(User.id).where(func.lower(User.nickname) == nickname.strip().lower())
    if except_user_id is not None:
        query = query.where(User.id != except_user_id)
    return await db.scalar(query.limit(1)) is not None


def _fit(base: str, suffix: str) -> str:
    return base[: MAX_LENGTH - len(suffix)] + suffix


async def suggest_nicknames(db: AsyncSession, base: str, count: int = 3) -> list[str]:
    """겹친 닉네임의 대체안 — 예: 슬라임킹0421, 슬라임킹_1, 슬라임킹_2 (모두 지금 사용 가능)"""
    base = base.strip()[:MAX_LENGTH] or "PLAYER"
    candidates = [_fit(base, f"{secrets.randbelow(10_000):04d}")]
    candidates += [_fit(base, f"_{n}") for n in range(1, 10)]
    candidates += [_fit(base, f"{secrets.randbelow(10_000):04d}") for _ in range(5)]
    taken = set(
        await db.scalars(
            select(func.lower(User.nickname)).where(func.lower(User.nickname).in_([c.lower() for c in candidates]))
        )
    )
    picked: list[str] = []
    for candidate in candidates:
        if candidate.lower() not in taken and candidate not in picked:
            picked.append(candidate)
        if len(picked) == count:
            break
    return picked
