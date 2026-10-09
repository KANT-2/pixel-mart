"""구글 로그인 — 구글 호출은 mock 처리 (로컬 DB 필요, 없으면 건너뜀)"""

import uuid

import pytest
from authlib.integrations.starlette_client import OAuthError
from fastapi.responses import RedirectResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.db import engine
from app.services.google_auth import oauth


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM users LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")


@pytest.fixture
def google_configured(monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")
    monkeypatch.setattr(settings, "google_client_secret", "test-secret")


def mock_google_user(monkeypatch, userinfo: dict | None = None, error: Exception | None = None) -> None:
    async def fake_authorize_access_token(request):
        if error:
            raise error
        return {"userinfo": userinfo}

    monkeypatch.setattr(oauth.google, "authorize_access_token", fake_authorize_access_token)


def google_userinfo(**overrides) -> dict:
    sub = uuid.uuid4().hex
    return {
        "sub": sub,
        "email": f"g-{sub[:8]}@pixelmart.test",
        "email_verified": True,
        "name": f"구글 플레이어 {sub[:6]}",  # 닉네임은 하나뿐이라 실행마다 다르게
    } | overrides


async def test_login_without_keys_is_503(client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "")
    res = await client.get("/api/auth/google/login")
    assert res.status_code == 503


async def test_login_redirects_to_google_with_proxy_callback(client, google_configured, monkeypatch):
    called = {}

    async def fake_authorize_redirect(request, redirect_uri):
        called["redirect_uri"] = redirect_uri
        return RedirectResponse("https://accounts.google.com/o/oauth2/v2/auth?fake=1", status_code=302)

    monkeypatch.setattr(oauth.google, "authorize_redirect", fake_authorize_redirect)
    res = await client.get("/api/auth/google/login")
    assert res.status_code == 302
    assert res.headers["location"].startswith("https://accounts.google.com/")
    assert called["redirect_uri"] == "http://localhost:3000/api/auth/google/callback"


async def signup_via_google(client, monkeypatch, info: dict, nickname: str | None = None):
    mock_google_user(monkeypatch, info)
    res = await client.get("/api/auth/google/callback", params={"code": "x", "state": "y"})
    assert res.status_code == 302 and res.headers["location"] == f"{settings.frontend_url}/signup"
    assert "pm_session" not in res.cookies and "pm_signup" in res.cookies
    return await client.post("/api/auth/signup", json={"nickname": nickname or info["name"]})


async def test_new_google_user_picks_nickname_before_account_exists(client, google_configured, monkeypatch):
    info = google_userinfo()
    mock_google_user(monkeypatch, info)
    await client.get("/api/auth/google/callback")
    # 닉네임을 고르기 전에는 계정도 세션도 없다
    assert (await client.get("/api/auth/me")).status_code == 401
    async with engine.connect() as conn:
        assert await conn.scalar(text("SELECT count(*) FROM users WHERE google_sub = :s"), {"s": info["sub"]}) == 0
    pending = (await client.get("/api/auth/signup")).json()
    assert pending == {"email": info["email"], "googleName": info["name"]}

    res = await client.post("/api/auth/signup", json={"nickname": "  " + info["name"] + " "})
    assert res.status_code == 201
    me = (await client.get("/api/auth/me")).json()
    assert (me["email"], me["nickname"]) == (info["email"], info["name"])
    assert (await client.get("/api/auth/signup")).status_code == 404  # 대기 쿠키는 지워짐


async def test_signup_with_taken_nickname_is_409_and_can_retry(client, google_configured, monkeypatch):
    taken = google_userinfo()
    assert (await signup_via_google(client, monkeypatch, taken)).status_code == 201
    await client.post("/api/auth/logout")

    info = google_userinfo()
    res = await signup_via_google(client, monkeypatch, info, nickname=taken["name"].upper())
    assert res.status_code == 409 and res.json()["detail"] == "이미 사용 중인 닉네임입니다."
    assert (await client.get("/api/auth/me")).status_code == 401
    suggestion = (await client.get("/api/users/nickname-check", params={"nickname": taken["name"]})).json()
    res = await client.post("/api/auth/signup", json={"nickname": suggestion["suggestions"][0]})
    assert res.status_code == 201 and res.json()["nickname"] == suggestion["suggestions"][0]


async def test_signup_without_google_step_is_404(client):
    assert (await client.get("/api/auth/signup")).status_code == 404
    assert (await client.post("/api/auth/signup", json={"nickname": "아무나"})).status_code == 404


async def test_callback_existing_user_logs_in_without_duplicate(client, google_configured, monkeypatch):
    info = google_userinfo()
    await signup_via_google(client, monkeypatch, info)
    first_id = (await client.get("/api/auth/me")).json()["id"]
    await client.post("/api/auth/logout")

    # 구글 이름이 바뀌어도 이미 정한 닉네임은 유지, 바로 로그인
    mock_google_user(monkeypatch, info | {"name": "새 이름"})
    res = await client.get("/api/auth/google/callback")
    assert res.headers["location"] == settings.frontend_url and "pm_session" in res.cookies
    me = (await client.get("/api/auth/me")).json()
    assert me["id"] == first_id
    assert me["nickname"] == info["name"]
    async with engine.connect() as conn:
        count = await conn.scalar(text("SELECT count(*) FROM users WHERE google_sub = :s"), {"s": info["sub"]})
    assert count == 1


async def test_callback_links_existing_dev_login_account(client, google_configured, monkeypatch):
    email = f"link-{uuid.uuid4().hex[:8]}@pixelmart.test"
    dev_user = (await client.post("/api/auth/dev-login", json={"email": email})).json()
    await client.post("/api/auth/logout")

    mock_google_user(monkeypatch, google_userinfo(email=email))
    await client.get("/api/auth/google/callback")
    assert (await client.get("/api/auth/me")).json()["id"] == dev_user["id"]


@pytest.mark.parametrize(
    "case",
    [
        {"error": OAuthError(error="access_denied")},
        {"userinfo": google_userinfo(email_verified=False)},
        {"userinfo": {}},
    ],
    ids=["google-error", "unverified-email", "no-userinfo"],
)
async def test_callback_failure_redirects_without_cookie(client, google_configured, monkeypatch, case):
    mock_google_user(monkeypatch, case.get("userinfo"), case.get("error"))
    res = await client.get("/api/auth/google/callback")
    assert res.status_code == 302
    assert res.headers["location"].endswith("/?loginError=google")
    assert "pm_session" not in res.cookies


async def test_callback_with_forged_state_is_rejected(client, google_configured):
    # mock 없이 실제 Authlib 검사: 로그인 시작 때 저장한 state가 없으면 거부
    res = await client.get("/api/auth/google/callback", params={"code": "x", "state": "forged"})
    assert res.status_code == 302
    assert res.headers["location"].endswith("/?loginError=google")
    assert "pm_session" not in res.cookies
