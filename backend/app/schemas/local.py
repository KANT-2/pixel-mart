from typing import Annotated, Literal

from pydantic import Field

from app.schemas.common import CamelModel

InterestType = Literal["work", "character", "style", "product_type"]


class RegionOut(CamelModel):
    code: str
    level: str  # sido / sigungu / zone
    parent_code: str | None
    name: str
    full_name: str  # 예: 성남시 분당구 판교


class InterestOut(CamelModel):
    id: int
    type: str
    name: str
    parent_id: int | None


class LocalProfileIn(CamelModel):
    region_code: str | None = Field(default=None, examples=["41135-01"], description="null이면 지역 설정 해제")
    interest_ids: Annotated[list[int], Field(max_length=20)] = Field(default_factory=list, examples=[[12, 51, 71]])
    fandom_opt_in: bool = Field(default=False, description="덕력지도 등 지역 익명 집계에 참여")
    profile_public: bool = Field(default=False, description="선택한 취향을 다른 사용자에게 공개")


class LocalProfileOut(CamelModel):
    """구매 금액·장바구니·정확한 위치·검색 기록은 항상 비공개라 여기에도 없다"""

    region: RegionOut | None
    interests: list[InterestOut]
    fandom_opt_in: bool
    profile_public: bool


class FandomOut(CamelModel):
    """덕력지도 한 칸 — 지역 × 취향 인원. 사용자 목록·이름·위치는 절대 포함하지 않는다"""

    region_code: str
    region_name: str
    interest_id: int
    interest: str
    interest_type: str
    count: int | None = Field(description="5명 미만이면 null")
    below_threshold: bool = Field(description="true면 화면에 '5명 미만'으로 표시")
    is_sample: bool = Field(description="true면 Cold Start용 샘플 데이터 — 화면에 '샘플' 표시")


class FandomRankOut(CamelModel):
    rank: int
    interest_id: int
    interest: str
    interest_type: str
    count: int
    is_sample: bool
