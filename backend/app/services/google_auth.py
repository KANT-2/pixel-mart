"""구글 로그인 — 구글이 확인해 준 사용자 정보로 users를 찾거나 만든다"""

from authlib.integrations.starlette_client import OAuth
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import User

oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def google_callback_url() -> str:
    # 브라우저는 3000번만 보므로 Next.js 프록시 경유 주소를 구글 콘솔에도 등록한다
    return f"{settings.frontend_url}/api/auth/google/callback"


async def get_or_create_google_user(db: AsyncSession, userinfo: dict) -> tuple[User, bool]:
    """(사용자, 새로 만들었는지) — 같은 이메일의 기존 계정(dev-login 등)이 있으면 구글 계정을 연결한다"""
    sub = userinfo.get("sub")
    email = userinfo.get("email")
    if not sub or not email or not userinfo.get("email_verified"):
        raise ValueError("구글 계정의 이메일을 확인할 수 없습니다.")

    user = await db.scalar(select(User).where(User.google_sub == sub))
    if user is None:
        user = await db.scalar(select(User).where(User.email == email, User.google_sub.is_(None)))
        if user is not None:
            user.google_sub = sub
    created = user is None
    if created:
        nickname = (userinfo.get("name") or email.split("@")[0]).strip()[:30] or email.split("@")[0][:30]
        user = User(email=email, google_sub=sub, nickname=nickname)
        db.add(user)

    await db.commit()
    await db.refresh(user)
    return user, created
