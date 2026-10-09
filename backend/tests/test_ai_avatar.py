"""AI 픽셀 아바타 — Gemini·Cloudflare 호출은 가짜 전송(MockTransport)으로 대신해 외부로 나가지 않는다"""

import base64
import json

import httpx
import pytest

from app.core.config import settings
from app.services import ai_avatar
from app.services.ai_avatar import AiAvatarError, RateLimiter, decode_photo, find_image

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


def test_find_image_in_steps_and_shortcut():
    steps = {
        "steps": [
            {"type": "thought"},
            {
                "type": "model_output",
                "content": [{"type": "text", "text": "hi"}, {"type": "image", "mime_type": "image/png", "data": "AAA"}],
            },
        ]
    }
    assert find_image(steps) == ("image/png", "AAA")
    assert find_image({"output_image": {"type": "image", "data": "BBB"}}) == ("image/png", "BBB")
    assert find_image({"steps": [{"type": "model_output", "content": [{"type": "text", "text": "blocked"}]}]}) is None


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
def gemini(monkeypatch):
    """가짜 Gemini 응답을 정하는 함수를 돌려준다. 실제 요청 내용은 calls에 기록"""
    calls: list[httpx.Request] = []
    state = {
        "handler": lambda request: httpx.Response(
            200, json={"output_image": {"type": "image", "mime_type": "image/png", "data": PIXEL}}
        )
    }

    def transport_handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return state["handler"](request)

    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        ai_avatar.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(transport_handler))
    )
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(settings, "cloudflare_account_id", "")  # .env에 Cloudflare 값이 있어도 Gemini로
    monkeypatch.setattr(settings, "cloudflare_api_token", "")
    monkeypatch.setattr(ai_avatar, "limiter", RateLimiter(per_hour=100))

    def respond(handler):
        state["handler"] = handler

    respond.calls = calls
    return respond


async def login(client) -> None:
    assert (await client.post("/api/auth/dev-login", json={"email": "ai-avatar@pixelmart.test"})).status_code == 200


async def test_requires_login(client):
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 401


async def test_requires_consent(client, gemini):
    await login(client)
    for body in ({"photo": PHOTO}, {"photo": PHOTO, "consent": False}):
        assert (await client.post("/api/avatars/ai", json=body)).status_code == 422
    assert gemini.calls == []  # 동의 없으면 외부로 보내지 않음


async def test_disabled_without_key(client, gemini, monkeypatch):
    await login(client)
    monkeypatch.setattr(settings, "gemini_api_key", "")
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 503
    assert gemini.calls == []


async def test_success_returns_image_and_sends_photo_once(client, gemini):
    await login(client)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 200
    assert res.json() == {"image": f"data:image/png;base64,{PIXEL}"}

    [request] = gemini.calls
    assert request.headers["x-goog-api-key"] == "test-key"
    sent = json.loads(request.content)
    assert sent["model"] == settings.gemini_image_model
    assert sent["input"][1] == {"type": "image", "mime_type": "image/jpeg", "data": PHOTO.split(",", 1)[1]}
    assert "pose" in sent["input"][0]["text"] and "magenta" in sent["input"][0]["text"]


@pytest.mark.parametrize(
    ("upstream", "status"),
    [
        (
            httpx.Response(
                200, json={"steps": [{"type": "model_output", "content": [{"type": "text", "text": "no"}]}]}
            ),
            422,
        ),
        (httpx.Response(500, json={"error": "boom"}), 502),
        (httpx.Response(429, json={"error": "quota"}), 429),
    ],
)
async def test_upstream_errors(client, gemini, upstream, status):
    await login(client)
    gemini(lambda request: upstream)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == status
    assert "test-key" not in res.text and "boom" not in res.text  # 키·원본 오류는 노출하지 않음


async def test_network_error_is_502(client, gemini):
    await login(client)

    def fail(request):
        raise httpx.ConnectError("down")

    gemini(fail)
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 502


async def test_rate_limit(client, gemini, monkeypatch):
    await login(client)
    monkeypatch.setattr(ai_avatar, "limiter", RateLimiter(per_hour=1))
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 200
    assert (await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})).status_code == 429


# ---- Cloudflare Workers AI (FLUX.2 klein) ----
@pytest.fixture
def cloudflare(gemini, monkeypatch):
    """gemini 픽스처의 가짜 전송을 그대로 쓰고 Cloudflare 설정만 켠다 (Cloudflare가 Gemini보다 우선)"""
    monkeypatch.setattr(settings, "cloudflare_account_id", "acct-123")
    monkeypatch.setattr(settings, "cloudflare_api_token", "cf-token")
    gemini(lambda request: httpx.Response(200, json={"result": {"image": PIXEL}, "success": True}))
    return gemini


async def test_status_shows_provider_for_consent_text(client, cloudflare, monkeypatch):
    res = (await client.get("/api/avatars/ai")).json()
    assert res == {
        "enabled": True,
        "provider": "cloudflare",
        "providerName": "Cloudflare Workers AI",
        "maxPhotoSide": 504,
    }
    monkeypatch.setattr(settings, "cloudflare_api_token", "")
    assert (await client.get("/api/avatars/ai")).json()["provider"] == "gemini"
    monkeypatch.setattr(settings, "gemini_api_key", "")
    res = (await client.get("/api/avatars/ai")).json()
    assert res["enabled"] is False and res["provider"] is None and "test-key" not in str(res)


async def test_cloudflare_sends_photo_as_reference_image(client, cloudflare):
    await login(client)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == 200
    assert res.json() == {"image": f"data:image/png;base64,{PIXEL}"}

    [request] = cloudflare.calls
    assert str(request.url).endswith("/accounts/acct-123/ai/run/@cf/black-forest-labs/flux-2-klein-4b")
    assert request.headers["authorization"] == "Bearer cf-token"
    assert request.headers["content-type"].startswith("multipart/form-data")
    body = request.content
    assert b'name="input_image_0"' in body and b"\xff\xd8\xff fake jpeg" in body  # 사진 원본 바이트
    assert b'name="prompt"' in body and b"magenta" in body
    assert b'name="width"\r\n\r\n512' in body and b'name="height"\r\n\r\n512' in body


@pytest.mark.parametrize(
    ("upstream", "status", "message"),
    [
        (httpx.Response(429, json={"errors": [{"message": "daily free allocation"}]}), 429, "무료 사용량"),
        (httpx.Response(400, json={"errors": [{"message": "image too large"}]}), 422, "다른 사진"),
        (httpx.Response(500, text="boom"), 502, "만들지 못했어요"),
        (httpx.Response(200, json={"result": {}, "success": True}), 422, "다른 사진"),
        (httpx.Response(200, text="not json"), 502, "만들지 못했어요"),
    ],
)
async def test_cloudflare_errors(client, cloudflare, upstream, status, message):
    await login(client)
    cloudflare(lambda request: upstream)
    res = await client.post("/api/avatars/ai", json={"photo": PHOTO, "consent": True})
    assert res.status_code == status and message in res.json()["detail"]
    assert "cf-token" not in res.text and "allocation" not in res.text and "boom" not in res.text


def test_image_mime():
    assert ai_avatar.image_mime("/9j/4AAQ") == "image/jpeg"
    assert ai_avatar.image_mime(PIXEL) == "image/png"
    assert ai_avatar.image_mime("UklGRxyz") == "image/webp"
