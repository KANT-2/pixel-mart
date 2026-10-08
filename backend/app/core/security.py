from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Response

from app.core.config import settings

# 로그인 세션은 JWT를 httpOnly 쿠키에 담아 전달합니다.
# 프론트는 Next.js rewrites(/api → :8000)로 같은 주소처럼 호출하므로 쿠키가 자동으로 따라갑니다.
SESSION_COOKIE = "pm_session"
ALGORITHM = "HS256"


def create_access_token(user_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode({"sub": str(user_id), "exp": expire}, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def set_session_cookie(response: Response, user_id: int) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        create_access_token(user_id),
        max_age=settings.jwt_expire_minutes * 60,
        httponly=True,
        samesite="lax",
        secure=not settings.is_local,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE)
