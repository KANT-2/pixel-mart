from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.core.config import settings
from app.core.security import clear_session_cookie, set_session_cookie
from app.deps import CurrentUser, DbSession
from app.models import User
from app.schemas.common import Message
from app.schemas.user import DevLoginIn, UserOut
from app.services.google_auth import get_or_create_google_user, google_callback_url, oauth
from app.services.nickname import unique_nickname

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/login", summary="구글 로그인 시작 (구글 로그인 화면으로 이동)")
async def google_login(request: Request):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "구글 로그인 설정(GOOGLE_CLIENT_ID/SECRET)이 없습니다."
        )
    return await oauth.google.authorize_redirect(request, google_callback_url())


@router.get("/google/callback", summary="구글 로그인 완료 → 쿠키 설정 → 메인으로 이동")
async def google_callback(request: Request, db: DbSession):
    """실패하면 쿠키 없이 메인으로 보내고 `?loginError=google`로 알린다"""
    try:
        token = await oauth.google.authorize_access_token(request)
        user, created = await get_or_create_google_user(db, token.get("userinfo") or {})
    except (OAuthError, ValueError):
        return RedirectResponse(f"{settings.frontend_url}/?loginError=google", status_code=status.HTTP_302_FOUND)

    if created:
        # TODO(BE-C 연동): award_badge() 시그니처가 확정되면 NEW_PLAYER 뱃지 지급
        pass

    response = RedirectResponse(settings.frontend_url, status_code=status.HTTP_302_FOUND)
    set_session_cookie(response, user.id)
    return response


@router.post("/dev-login", response_model=UserOut, summary="[로컬 전용] 이메일만으로 로그인")
async def dev_login(body: DevLoginIn, response: Response, db: DbSession):
    """구글 로그인이 완성되기 전에도 장바구니·주문·토너먼트 같은 '로그인 필요' 기능을
    개발할 수 있게 해 주는 임시 로그인. ENV=local 일 때만 동작합니다."""
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    user = await db.scalar(select(User).where(User.email == body.email))
    if user is None:
        user = User(email=body.email, nickname=await unique_nickname(db, body.nickname or body.email.split("@")[0]))
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
