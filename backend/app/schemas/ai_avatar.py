from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class AiAvatarIn(CamelModel):
    """AI 픽셀 아바타 요청 — 사진은 저장하지 않고 Gemini로 한 번만 보낸다 (동의 필수)"""

    photo: str = Field(max_length=6_000_000, examples=["data:image/jpeg;base64,/9j/4AAQ..."])
    consent: Literal[True] = Field(description="사진이 Google Gemini로 전송되는 데 동의")


class AiAvatarOut(CamelModel):
    """생성된 픽셀아트 원본 — 브라우저에서 격자로 정리한 뒤 PUT /api/users/me/avatar 로 저장"""

    image: str
