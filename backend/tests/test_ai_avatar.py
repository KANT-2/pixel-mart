"""AI 픽셀 아바타 — Cloudflare 호출은 가짜 전송(MockTransport)으로 대신해 외부로 나가지 않는다"""

import base64

import httpx
import pytest

from app.core.config import settings
from app.services import ai_avatar
from app.services.ai_avatar import AiAvatarError, RateLimiter, decode_photo

PHOTO = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff fake jpeg").decode()
PIXEL = base64.b64encode(b"\x89PNG\r\n\x1a\n fake png").decode()


# ---- 순수 함수 ----
@pytest.mark.parametrize(
    "value",
    ["data:image/gif;base64,R0lG", "image/jpeg;base64,abc", "data:image/png,abc", "data:image/png;base64,***"],
)
def test_decode_photo_rejects_bad_input(value):
    with pytest.raises(AiAvatarError) as error:
        decode_photo(value)
    assert error.value.status == 422


def test_decode_photo_rejects_large_photo():
    big = "data:image/png;base64," + "A" * (6 * 1024 * 1024)
    with pytest.raises(AiAvatarError):
        decode_photo(big)


def test_rate_limiter_zero_means_unlimited():
    limiter = RateLimiter(per_hour=0)
    for i in range(50):
        limiter.check(1, now=i)


def test_rate_limiter_window():
    limiter = RateLimiter(per_hour=2, window=3600)
    limiter.check(1, now=0)
    limiter.check(1, now=10)
    with pytest.raises(AiAvatarError) as error:
        limiter.check(1, now=20)
    assert error.value.status == 429
    limiter.check(2, now=20)  # 다른 사용자는 따로
    limiter.check(1, now=3601)  # 1시간 지나면 다시 가능


# ---- API ----
@pytest.fixture
def upstream(monkeypatch):
    """가짜 Cloudflare 응답을 정하는 함수를 돌려준다. 실제 요청 내용은 calls에 기록"""
    calls: list[httpx.Request] = []
    state = {"handler": lambda request: httpx.Response(200, json={"result": {"image": PIXEL}, "success": True})}

    def transport_handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return state["handler"](request)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        ai_avatar.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(transport_handler))
    )
    monkeypatch.setattr(settings, "cloudflare_account_id", "acct-123")
    monkeypatch.setattr(settings, "cloudflare_api_token", "cf-token")
    monkeypatch.setattr(ai_avatar, "limiter", RateLimiter(per_hour=100))

    def respond(handler):
        state["handler"] = handler

    respond.calls = calls
    return respond


async def login(client) -> None:
    assert (await client.post("/api/auth/dev-login", json={"email": "ai-avatar@pixelmart.test"})).status_code == 200


async def test_requires_login(client):
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 401


async def test_requires_consent(client, upstream):
    await login(client)
    for body in ({"photo": PHOTO}, {"photo": PHOTO, "consent": False}):
        assert (await client.post("/api/avatars/ai", json=body)).status_code == 422
    assert upstream.calls == []  # 동의 없으면 외부로 보내지 않음


async def test_disabled_without_key(client, upstream, monkeypatch):
    await login(client)
    monkeypatch.setattr(settings, "cloudflare_api_token", "")
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 503
    assert upstream.calls == []


async def test_network_error_is_502(client, upstream):
    await login(client)

    def fail(request):
        raise httpx.ConnectError("down")

    upstream(fail)
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 502


async def test_rate_limit(client, upstream, monkeypatch):
    await login(client)
    monkeypatch.setattr(ai_avatar, "limiter", RateLimiter(per_hour=1))
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 200
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 429


async def test_status_shows_provider_for_consent_text(client, upstream, monkeypatch):
    res = (await client.get("/api/avatars/ai")).json()
    assert res == {
        "enabled": True,
        "provider": "cloudflare",
        "providerName": "Cloudflare Workers AI",
        "maxPhotoSide": 504,
    }
    monkeypatch.setattr(settings, "cloudflare_api_token", "")
    res = (await client.get("/api/avatars/ai")).json()
    assert res["enabled"] is False and res["provider"] is None and "cf-token" not in str(res)


async def test_cloudflare_sends_photo_as_reference_image(client, upstream):
    await login(client)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 200
    assert res.json() == {"image": f"data:image/png;base64,{PIXEL}"}

    [request] = upstream.calls
    assert str(request.url).endswith("/accounts/acct-123/ai/run/@cf/black-forest-labs/flux-2-klein-4b")
    assert request.headers["authorization"] == "Bearer cf-token"
    assert request.headers["content-type"].startswith("multipart/form-data")
    body = request.content
    assert b'name="input_image_0"' in body and b"\xff\xd8\xff fake jpeg" in body  # 사진 원본 바이트
    assert b'name="prompt"' in body and b"magenta" in body
    assert b'name="width"\r\n\r\n512' in body and b'name="height"\r\n\r\n512' in body


@pytest.mark.parametrize(
    ("reply", "status", "message"),
    [
        (httpx.Response(429, json={"errors": [{"message": "daily free allocation"}]}), 429, "무료 사용량"),
        (httpx.Response(400, json={"errors": [{"message": "image too large"}]}), 422, "다른 사진"),
        (httpx.Response(500, text="boom"), 502, "만들지 못했어요"),
        (httpx.Response(200, json={"result": {}, "success": True}), 422, "다른 사진"),
        (httpx.Response(200, text="not json"), 502, "만들지 못했어요"),
    ],
)
async def test_cloudflare_errors(client, upstream, reply, status, message):
    await login(client)
    upstream(lambda request: reply)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == status and message in res.json()["detail"]
    assert "cf-token" not in res.text and "allocation" not in res.text and "boom" not in res.text


async def test_cloudflare_retries_false_positive_safety_flag(client, upstream):
    """출력 안전 필터(3030)는 시드에 따라 오탐 — 다른 시드로 다시 시도한다"""
    await login(client)
    flagged = httpx.Response(400, json={"errors": [{"code": 3030, "message": "flagged"}], "success": False})
    ok = httpx.Response(200, json={"result": {"image": PIXEL}, "success": True})
    # 처음 두 번은 오탐, 세 번째에 성공 — 하나씩 차례로
    upstream(lambda request: flagged if len(upstream.calls) <= 2 else ok)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 200
    seeds = [r.content.split(b'name="seed"\r\n\r\n')[1].split(b"\r\n")[0] for r in upstream.calls]
    assert len(seeds) == 3 and len(set(seeds)) == 3  # 성공하면 멈추고, 매번 다른 시드


async def test_cloudflare_gives_up_after_five_flags(client, upstream):
    await login(client)
    upstream(lambda request: httpx.Response(400, json={"errors": [{"code": 3030}], "success": False}))
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 422 and len(upstream.calls) == 5
    assert "바로 픽셀로" in res.json()["detail"]  # 브라우저 픽셀 변환으로 이어지게


def test_image_mime():
    assert ai_avatar.image_mime("/9j/4AAQ") == "image/jpeg"
    assert ai_avatar.image_mime(PIXEL) == "image/png"
    assert ai_avatar.image_mime("UklGRxyz") == "image/webp"
