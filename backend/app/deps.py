"""라우터에서 공통으로 쓰는 의존성

사용 예:
    @router.get("/me")
    async def me(user: CurrentUser, db: DbSession): ...
"""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import SESSION_COOKIE, decode_access_token
from app.models import User

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_optional_user(
    db: DbSession,
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> User | None:
    if not session_token:
        return None
    user_id = decode_access_token(session_token)
    return await db.get(User, user_id) if user_id else None


async def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "로그인이 필요합니다.")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
CurrentUser = Annotated[User, Depends(get_current_user)]
