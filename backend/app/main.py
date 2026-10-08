from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import settings
from app.routers import auth, cancel_requests, cart, faqs, health, orders, products, users

app = FastAPI(
    title="PIXEL MART API",
    version="0.1.0",
    # 프론트(3000)의 /api 프록시로도 문서를 볼 수 있게 /api 아래에 둠
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# 평소에는 Next.js rewrites로 같은 주소처럼 호출하지만, 8000번을 직접 부르는 경우를 위해 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 구글 로그인(Authlib)이 state 값을 잠깐 보관하는 용도 — 로그인 세션 자체는 pm_session 쿠키(JWT)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.jwt_secret,
    session_cookie="pm_oauth",
    max_age=600,
    https_only=not settings.is_local,
)

# 새 라우터는 여기에 한 줄씩 추가 (모든 API는 /api 로 시작)
for router in (
    health.router,
    auth.router,
    products.router,
    faqs.router,
    cart.router,
    orders.router,
    orders.dev_router,
    cancel_requests.router,
    cancel_requests.dev_router,
    users.router,
):
    app.include_router(router, prefix="/api")
