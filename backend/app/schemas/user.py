from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, Field, StringConstraints

from app.schemas.common import CamelModel
from app.services.avatar import validate_avatar_data_url


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


class UserUpdateIn(CamelModel):
    nickname: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)] = Field(
        examples=["PLAYER 1"]
    )


Nickname = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=30)]


class NicknameCheckOut(CamelModel):
    nickname: str
    available: bool
    suggestions: list[str] = Field(
        default_factory=list, description="겹칠 때만 — 지금 사용 가능한 대체 닉네임 최대 3개"
    )


class SignupPendingOut(CamelModel):
    """구글 확인은 끝났고 닉네임만 고르면 되는 상태"""

    email: str
    google_name: str


class SignupIn(CamelModel):
    nickname: Nickname = Field(examples=["슬라임킹"])


class AvatarIn(CamelModel):
    """브라우저에서 픽셀 변환한 PNG (data URL, 디코딩 200KB 이하). 얼굴 원본 사진은 받지 않는다"""

    avatar_url: Annotated[str, AfterValidator(validate_avatar_data_url)] = Field(
        examples=["data:image/png;base64,iVBORw0KGgo..."]
    )
