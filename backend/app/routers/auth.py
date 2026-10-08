from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from app.core.config import settings
from app.core.security import clear_session_cookie, set_session_cookie
from app.deps import CurrentUser, DbSession
from app.models import User
from app.schemas.common import Message
from app.schemas.user import DevLoginIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# TODO(BE-A): 구글 로그인 — GET /auth/google/login, GET /auth/google/callback (docs/backend/ROADMAP.md 참고)


@router.post("/dev-login", response_model=UserOut, summary="[로컬 전용] 이메일만으로 로그인")
async def dev_login(body: DevLoginIn, response: Response, db: DbSession):
    """구글 로그인이 완성되기 전에도 장바구니·주문·토너먼트 같은 '로그인 필요' 기능을
    개발할 수 있게 해 주는 임시 로그인. ENV=local 일 때만 동작합니다."""
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    user = await db.scalar(select(User).where(User.email == body.email))
    if user is None:
        user = User(email=body.email, nickname=body.nickname or body.email.split("@")[0][:30])
        db.add(user)
        await db.commit()
        await db.refresh(user)

    set_session_cookie(response, user.id)
    return user


@router.post("/logout", response_model=Message)
async def logout(response: Response):
    clear_session_cookie(response)
    return Message(message="로그아웃되었습니다.")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser):
    return user
