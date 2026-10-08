"""픽셀 아바타 data URL 검사 — 변환은 브라우저(Canvas)에서 하고 서버는 결과 PNG만 저장한다"""

import base64
import binascii

DATA_URL_PREFIX = "data:image/png;base64,"
MAX_AVATAR_BYTES = 50 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def validate_avatar_data_url(value: str) -> str:
    """PNG data URL이고 디코딩 크기가 50KB 이하인지 확인. 문제가 있으면 ValueError(한글 메시지)"""
    if not value.startswith(DATA_URL_PREFIX):
        raise ValueError("아바타는 data:image/png;base64, 로 시작하는 PNG data URL이어야 합니다.")

    encoded = value.removeprefix(DATA_URL_PREFIX)
    # 디코딩 전에 길이로 먼저 걸러 큰 요청을 메모리에 풀지 않음 (base64는 4글자 → 3바이트)
    if len(encoded) * 3 // 4 > MAX_AVATAR_BYTES + 3:
        raise ValueError("아바타 이미지는 50KB 이하여야 합니다.")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("아바타 이미지의 base64 형식이 올바르지 않습니다.") from None

    if len(raw) > MAX_AVATAR_BYTES:
        raise ValueError("아바타 이미지는 50KB 이하여야 합니다.")
    if not raw.startswith(PNG_SIGNATURE):
        raise ValueError("PNG 이미지만 저장할 수 있습니다.")
    return value
