from typing import Annotated

from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter, Cookie, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.core.config import settings
from app.core.security import (
    SIGNUP_COOKIE,
    clear_session_cookie,
    create_signup_token,
    decode_signup_token,
    set_session_cookie,
    set_signup_cookie,
)
from app.deps import CurrentUser, DbSession
from app.models import User
from app.schemas.common import Message
from app.schemas.user import DevLoginIn, SignupIn, SignupPendingOut, UserOut
from app.services.google_auth import find_google_user, google_callback_url, oauth, verified_google_info
from app.services.nickname import TAKEN_MESSAGE, is_taken

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google/login", summary="구글 로그인 시작 (구글 로그인 화면으로 이동)")
async def google_login(request: Request):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "구글 로그인 설정(GOOGLE_CLIENT_ID/SECRET)이 없습니다."
        )
    return await oauth.google.authorize_redirect(request, google_callback_url())


@router.get("/google/callback", summary="구글 로그인 완료 → 기존 회원은 메인, 새 사용자는 닉네임 고르기(/signup)")
async def google_callback(request: Request, db: DbSession):
    """실패하면 쿠키 없이 메인으로 보내고 `?loginError=google`로 알린다.
    새 사용자는 계정을 바로 만들지 않고, 닉네임을 직접 고를 때까지 15분짜리 가입 대기 쿠키만 준다."""
    try:
        token = await oauth.google.authorize_access_token(request)
        sub, email, name = verified_google_info(token.get("userinfo") or {})
        user = await find_google_user(db, sub, email)
    except (OAuthError, ValueError):
        return RedirectResponse(f"{settings.frontend_url}/?loginError=google", status_code=status.HTTP_302_FOUND)

    if user is None:
        response = RedirectResponse(f"{settings.frontend_url}/signup", status_code=status.HTTP_302_FOUND)
        set_signup_cookie(response, create_signup_token(sub, email, name or email.split("@")[0]))
        return response
    response = RedirectResponse(settings.frontend_url, status_code=status.HTTP_302_FOUND)
    set_session_cookie(response, user.id)
    return response


def _pending(token: str | None) -> dict:
    payload = decode_signup_token(token) if token else None
    if payload is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "가입 대기 정보가 없어요. 구글 로그인부터 다시 해 주세요.")
    return payload


@router.get(
    "/signup", response_model=SignupPendingOut, summary="가입 대기 정보 (구글 이메일·구글 이름) — 닉네임 고르기 화면용"
)
async def signup_pending(signup: Annotated[str | None, Cookie(alias=SIGNUP_COOKIE)] = None):
    payload = _pending(signup)
    return SignupPendingOut(email=payload["email"], google_name=payload["name"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="닉네임을 골라 가입 완료")
async def signup(
    body: SignupIn,
    response: Response,
    db: DbSession,
    signup: Annotated[str | None, Cookie(alias=SIGNUP_COOKIE)] = None,
):
    """닉네임이 겹치면 409 — 자동으로 바꾸지 않는다 (추천은 GET /users/nickname-check)"""
    payload = _pending(signup)
    user = await find_google_user(db, payload["gsub"], payload["email"])  # 그사이 연결된 계정이면 그대로 로그인
    if user is None:
        if await is_taken(db, body.nickname):
            raise HTTPException(status.HTTP_409_CONFLICT, TAKEN_MESSAGE)
        user = User(email=payload["email"], google_sub=payload["gsub"], nickname=body.nickname)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        # TODO(BE-C 연동): award_badge() 시그니처가 확정되면 NEW_PLAYER 뱃지 지급
    response.delete_cookie(SIGNUP_COOKIE)
    set_session_cookie(response, user.id)
    return user


@router.post("/dev-login", response_model=UserOut, summary="[로컬 전용] 이메일만으로 로그인")
async def dev_login(body: DevLoginIn, response: Response, db: DbSession):
    """구글 로그인이 완성되기 전에도 장바구니·주문·토너먼트 같은 '로그인 필요' 기능을
    개발할 수 있게 해 주는 임시 로그인. ENV=local 일 때만 동작합니다."""
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    user = await db.scalar(select(User).where(User.email == body.email))
    if user is None:
        nickname = (body.nickname or "").strip() or body.email.split("@")[0][:30]
        if await is_taken(db, nickname):
            raise HTTPException(status.HTTP_409_CONFLICT, TAKEN_MESSAGE)
        user = User(email=body.email, nickname=nickname)
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
