"""닉네임은 대소문자 구분 없이 하나뿐 — 위시맵 닉네임 검색·선물 상대를 헷갈리지 않게"""

import secrets

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User

MAX_LENGTH = 30


async def is_taken(db: AsyncSession, nickname: str, except_user_id: int | None = None) -> bool:
    query = select(User.id).where(func.lower(User.nickname) == nickname.strip().lower())
    if except_user_id is not None:
        query = query.where(User.id != except_user_id)
    return await db.scalar(query.limit(1)) is not None


async def unique_nickname(db: AsyncSession, base: str) -> str:
    """새 계정용 — 이미 있으면 '#4자리 숫자'를 붙인다 (구글 이름이 겹쳐도 가입은 막지 않음)"""
    base = base.strip()[:MAX_LENGTH] or "PLAYER"
    if not await is_taken(db, base):
        return base
    while True:
        suffix = f"#{secrets.randbelow(10_000):04d}"
        candidate = base[: MAX_LENGTH - len(suffix)] + suffix
        if not await is_taken(db, candidate):
            return candidate
