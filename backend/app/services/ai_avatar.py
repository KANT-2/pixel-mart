"""AI 픽셀 아바타 — 사진을 Gemini 이미지 모델에 넘겨 픽셀아트 스프라이트로 다시 그린다.

사진은 요청 처리 동안 메모리에서만 쓰고 저장·로그하지 않는다 (정책: docs/AVATAR_POLICY.md).
결과 이미지도 저장하지 않고 돌려주며, 브라우저가 픽셀 격자로 정리한 뒤
사용자가 고르면 기존 아바타 API로 저장한다.
"""

import base64
import binascii
import time
from collections import defaultdict, deque

import httpx

from app.core.config import settings

INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_BYTES = 4 * 1024 * 1024
TIMEOUT_SECONDS = 90

# 사람·동물·캐릭터를 인식해 자세·옷차림·비율을 살린 픽셀 스프라이트로 — 배경은 자르기 쉬운 단색
PROMPT = (
    "Recreate the main subject of this photo as a single full-body pixel-art game sprite. "
    "The subject may be a person, an animal, or a character/figure; identify which and keep it recognizable: "
    "preserve the pose, outfit and clothing colors, hairstyle or fur pattern, accessories, and body proportions. "
    "Style: cute 16-bit retro game character sprite, about 48 pixels tall, crisp hard-edged square pixels, "
    "limited palette of at most 16 colors, a dark 1-pixel outline, "
    "no anti-aliasing, no blur, no text, no frame, no shadow. "
    "Background: one flat solid magenta color (#FF00FF) everywhere outside the sprite. "
    "Center the sprite and show the whole body. "
    "Keep it friendly and all-ages; never sexualize or make it violent."
)


class AiAvatarError(Exception):
    """사용자에게 보여 줄 한글 메시지와 HTTP 상태"""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class RateLimiter:
    """사용자별 1시간 요청 수 제한 (로컬 단일 서버용 메모리 카운터)"""

    def __init__(self, per_hour: int, window: float = 3600):
        self.per_hour = per_hour
        self.window = window
        self.calls: dict[int, deque[float]] = defaultdict(deque)

    def check(self, user_id: int, now: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        calls = self.calls[user_id]
        while calls and now - calls[0] >= self.window:
            calls.popleft()
        if len(calls) >= self.per_hour:
            raise AiAvatarError(429, "AI 아바타는 1시간에 정해진 횟수만 만들 수 있어요. 잠시 후 다시 시도해 주세요.")
        calls.append(now)


limiter = RateLimiter(settings.ai_avatar_per_hour)


def decode_photo(data_url: str) -> tuple[str, str]:
    """data URL → (mime, base64). 형식·크기가 맞지 않으면 AiAvatarError(422)"""
    head, _, encoded = data_url.partition(",")
    mime = head.removeprefix("data:").removesuffix(";base64")
    if not head.startswith("data:") or not head.endswith(";base64") or mime not in ALLOWED_TYPES:
        raise AiAvatarError(422, "JPEG·PNG·WebP 사진만 사용할 수 있어요.")
    if len(encoded) * 3 // 4 > MAX_PHOTO_BYTES + 3:
        raise AiAvatarError(422, "사진은 4MB 이하로 줄여서 보내 주세요.")
    try:
        base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise AiAvatarError(422, "사진 데이터를 읽을 수 없어요.") from None
    return mime, encoded


def find_image(payload: object) -> tuple[str, str] | None:
    """응답 JSON 어디에 있든 첫 이미지 블록({type: image, data})을 찾는다 (steps·output_image 형식 모두)"""
    if isinstance(payload, dict):
        if payload.get("type") == "image" and isinstance(payload.get("data"), str):
            return payload.get("mime_type") or payload.get("mimeType") or "image/png", payload["data"]
        for value in payload.values():
            if found := find_image(value):
                return found
    elif isinstance(payload, list):
        for value in payload:
            if found := find_image(value):
                return found
    return None


async def generate_pixel_avatar(photo_data_url: str, client: httpx.AsyncClient | None = None) -> str:
    """사진 → 픽셀아트 이미지 data URL. 사진·결과는 저장하지 않는다"""
    if not settings.gemini_api_key:
        raise AiAvatarError(503, "AI 아바타가 아직 설정되지 않았어요. 픽셀 캔버스로 직접 만들어 보세요.")
    mime, encoded = decode_photo(photo_data_url)
    body = {
        "model": settings.gemini_image_model,
        "input": [{"type": "text", "text": PROMPT}, {"type": "image", "mime_type": mime, "data": encoded}],
        "response_format": {"type": "image", "aspect_ratio": "1:1", "image_size": "1K"},
    }
    headers = {"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"}
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
    try:
        response = await client.post(INTERACTIONS_URL, json=body, headers=headers)
    except httpx.HTTPError:
        raise AiAvatarError(502, "AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.") from None
    finally:
        if own_client:
            await client.aclose()

    if response.status_code == 429:
        raise AiAvatarError(429, "AI 사용량이 많아요. 잠시 후 다시 시도해 주세요.")
    if response.status_code >= 400:
        # 응답 본문(키·사진 포함 가능성)은 로그·메시지에 남기지 않는다
        raise AiAvatarError(502, "AI 아바타를 만들지 못했어요. 잠시 후 다시 시도해 주세요.")
    found = find_image(response.json())
    if found is None:
        # 안전 필터 차단·인식 실패 등 이미지가 없는 응답
        raise AiAvatarError(
            422, "이 사진으로는 아바타를 만들 수 없어요. 사람·동물·캐릭터가 잘 보이는 다른 사진을 골라 주세요."
        )
    out_mime, data = found
    return f"data:{out_mime};base64,{data}"
