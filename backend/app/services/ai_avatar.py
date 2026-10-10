"""AI 픽셀 아바타 — 사진을 이미지 모델에 넘겨 픽셀아트 스프라이트로 다시 그린다.

제공자: Cloudflare Workers AI(FLUX.2 klein, 무료 일일 할당). 키가 없으면 AI 만들기만 꺼진다.

사진은 요청 처리 동안 메모리에서만 쓰고 저장·로그하지 않는다 (정책: docs/AVATAR_POLICY.md).
결과 이미지도 저장하지 않고 돌려주며, 브라우저가 픽셀 격자로 정리한 뒤
사용자가 고르면 기존 아바타 API로 저장한다.
"""

import base64
import binascii
import logging
import secrets
import time
from collections import defaultdict, deque

import httpx

from app.core.config import settings

CLOUDFLARE_URL = "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}"
# FLUX.2 klein은 참고 이미지가 512x512보다 작아야 한다 — 브라우저가 긴 변을 이 크기로 줄여 보낸다
CLOUDFLARE_MAX_SIDE = 504
OUTPUT_SIDE = 512  # 브라우저가 48칸 격자로 다시 줄이므로 크게 받을 필요가 없다(무료 할당 절약)
PROVIDER_NAME = "Cloudflare Workers AI"
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
    "Keep it friendly and all-ages."
)


def is_configured() -> bool:
    return bool(settings.cloudflare_account_id and settings.cloudflare_api_token)


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
        if self.per_hour <= 0:  # 0이면 제한 없음
            return
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


def image_mime(data: str) -> str:
    """base64 앞부분으로 형식 판별 (PNG·JPEG·WebP)"""
    if data.startswith("iVBOR"):
        return "image/png"
    if data.startswith("/9j/"):
        return "image/jpeg"
    if data.startswith("UklGR"):
        return "image/webp"
    return "image/png"


NOT_CONFIGURED = "AI 아바타가 아직 설정되지 않았어요. 픽셀 캔버스로 직접 만들어 보세요."
CANNOT_DRAW = "이 사진으로는 아바타를 만들 수 없어요. 사람·동물·캐릭터가 잘 보이는 다른 사진을 골라 주세요."
FAILED = "AI 아바타를 만들지 못했어요. 잠시 후 다시 시도해 주세요."
FLAGGED_MESSAGE = (
    "AI가 이 사진으로 그리지 못했어요. 유명 캐릭터의 공식 그림은 막힐 수 있어요 — "
    "내 사진·직접 그린 그림으로 하거나, 사진을 바로 픽셀로 바꿔 보세요."
)


async def _post(client: httpx.AsyncClient | None, url: str, **kwargs) -> httpx.Response:
    own_client = client is None
    client = client or httpx.AsyncClient(timeout=TIMEOUT_SECONDS)
    try:
        return await client.post(url, **kwargs)
    except httpx.HTTPError:
        raise AiAvatarError(502, "AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.") from None
    finally:
        if own_client:
            await client.aclose()


FLAGGED = 3030  # Cloudflare 출력 안전 필터 — 같은 입력도 시드에 따라 오탐이 나서 다른 시드로 다시 시도
# 실측: 같은 그림도 시드에 따라 20~70%가 걸린다 — 사람 사진은 더 자주 걸려 5번까지
CLOUDFLARE_ATTEMPTS = 5
logger = logging.getLogger(__name__)


def _error_codes(response: httpx.Response) -> set[int]:
    try:
        errors = response.json().get("errors") or []
    except (ValueError, AttributeError):
        return set()
    return {e.get("code") for e in errors if isinstance(e, dict)}


async def _cloudflare(mime: str, encoded: str, client: httpx.AsyncClient | None) -> str:
    url = CLOUDFLARE_URL.format(account=settings.cloudflare_account_id, model=settings.cloudflare_image_model)
    photo = base64.b64decode(encoded)
    extension = mime.split("/")[1]
    for _ in range(CLOUDFLARE_ATTEMPTS):
        response = await _post(
            client,
            url,
            headers={"Authorization": f"Bearer {settings.cloudflare_api_token}"},
            data={
                "prompt": PROMPT,
                "width": str(OUTPUT_SIDE),
                "height": str(OUTPUT_SIDE),
                "seed": str(secrets.randbelow(2**31)),
            },
            files={"input_image_0": (f"photo.{extension}", photo, mime)},
        )
        codes = _error_codes(response) if response.status_code >= 400 else set()
        if response.status_code >= 400:
            # 원인 파악용 — 상태·오류 코드만 남긴다 (사진·키·응답 본문은 남기지 않음)
            logger.warning("cloudflare ai avatar failed: status=%s codes=%s", response.status_code, sorted(codes))
        if response.status_code != 400 or FLAGGED not in codes:
            break
    if response.status_code == 400 and FLAGGED in _error_codes(response):
        raise AiAvatarError(422, FLAGGED_MESSAGE)
    if response.status_code == 429:
        raise AiAvatarError(429, "오늘 AI 무료 사용량을 다 썼어요. 내일 다시 시도하거나 픽셀 캔버스로 만들어 보세요.")
    if response.status_code in (400, 413):
        # 사진 크기·형식 문제나 안전 필터 — 본문은 노출하지 않는다
        raise AiAvatarError(422, CANNOT_DRAW)
    if response.status_code >= 400:
        raise AiAvatarError(502, FAILED)
    try:
        payload = response.json()
    except ValueError:
        raise AiAvatarError(502, FAILED) from None
    result = payload.get("result") if isinstance(payload, dict) else None
    image = (result or {}).get("image") if isinstance(result, dict) else None
    if not isinstance(image, str) or not image:
        raise AiAvatarError(422, CANNOT_DRAW)
    return f"data:{image_mime(image)};base64,{image}"


async def generate_pixel_avatar(photo_data_url: str, client: httpx.AsyncClient | None = None) -> str:
    """사진 → 픽셀아트 이미지 data URL. 사진·결과는 저장하지 않는다"""
    if not is_configured():
        raise AiAvatarError(503, NOT_CONFIGURED)
    mime, encoded = decode_photo(photo_data_url)
    return await _cloudflare(mime, encoded, client)
