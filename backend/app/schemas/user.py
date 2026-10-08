from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class UserOut(CamelModel):
    id: int
    email: str
    nickname: str
    avatar_url: str | None
    created_at: datetime


class DevLoginIn(CamelModel):
    """로컬 개발 전용 로그인 — 구글 로그인 완성 전까지 다른 기능 개발·테스트용"""

    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=320, examples=["player1@pixelmart.test"])
    nickname: str | None = Field(default=None, max_length=30, examples=["PLAYER 1"])
