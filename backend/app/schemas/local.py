from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.common import CamelModel
from app.schemas.product import ProductOut

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
    map_avatar_opt_in: bool = Field(default=False, description="덕력지도 핀에 내 아바타 표시 (5명 이상 지역에서만)")
    nickname_public: bool = Field(default=False, description="위시맵 WANT 글에 닉네임·아바타 표시, 닉네임 검색 허용")


class LocalProfileOut(CamelModel):
    """구매 금액·장바구니·정확한 위치·검색 기록은 항상 비공개라 여기에도 없다"""

    region: RegionOut | None
    interests: list[InterestOut]
    fandom_opt_in: bool
    profile_public: bool
    map_avatar_opt_in: bool
    nickname_public: bool


class MapAvatarsOut(CamelModel):
    """덕력지도 지역 블록 하나의 아바타 핀 — 사용자 id·닉네임·위치는 절대 포함하지 않는다"""

    region_code: str
    region_name: str
    count: int | None = Field(description="아바타 표시에 동의한 인원, 5명 미만이면 null")
    below_threshold: bool
    avatars: list[str | None] = Field(description="무작위 최대 6개 — PNG data URL, null이면 기본 슬라임")


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


class TradePostIn(CamelModel):
    kind: Literal["have", "want", "sell"]
    item_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)] = Field(
        examples=["오로치마루 키링"]
    )
    product_id: int | None = Field(default=None, description="PIXEL MART 상품이면 id (상품 이미지 참조·매칭)")
    interest_id: int | None = Field(default=None, description="관련 취향 태그 id (예: 오로치마루) — 매칭에 사용")
    condition: Literal["new", "like_new", "used"] | None = Field(default=None, description="have·sell은 필수")
    price: Annotated[int, Field(ge=0, le=10_000_000)] | None = Field(default=None, description="희망 가격(원)")
    trade_method: Literal["direct", "delivery", "both"] = "direct"
    content: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""


class TradeStatusIn(CamelModel):
    status: Literal["done", "hidden"]


class TradeAuthorOut(CamelModel):
    """위시맵 닉네임 공개에 동의한 작성자의 WANT 글에만 붙는다 (id·이메일·지역 상세 없음)"""

    nickname: str
    avatar_url: str | None


class TradePostOut(CamelModel):
    """정책 10장의 노출 항목만 — 작성자 정보·연락처·정확한 장소는 없다"""

    id: int
    kind: str
    status: str
    item_name: str
    condition: str | None
    price: int | None
    trade_method: str
    content: str
    product: ProductOut | None
    interest: InterestOut | None
    region_code: str
    region_name: str
    is_mine: bool
    is_sample: bool
    is_demo: bool = Field(default=False, description="시연용 데모 이웃의 글 — 화면에 '데모 이웃' 표시")
    created_at: datetime
    author: TradeAuthorOut | None = Field(default=None, description="WANT 글 + 작성자가 닉네임 공개에 동의했을 때만")


class WishWantsOut(CamelModel):
    """위시맵 지역 블록 하나의 진행 중 WANT 글 수와 핀 이미지 (하위 지역 포함)"""

    region_code: str
    count: int
    images: list[str | None] = Field(description="핀으로 쓸 상품 이미지, 연결 상품이 없으면 null (최대 4개)")
    sample: bool = Field(description="샘플 글만 있는 지역")


class TradeMatchOut(CamelModel):
    """내 WANT ↔ 이웃의 HAVE/SELL. 거리 대신 같은 생활권/같은 구로 표시, mutual이면 맞교환 후보"""

    want: TradePostOut
    offer: TradePostOut
    proximity: Literal["same_zone", "same_district"]
    mutual: bool


class WishMapOut(CamelModel):
    rank: int
    product: ProductOut
    count: int
    is_sample: bool = Field(description="true면 Cold Start용 샘플 데이터 — 화면에 '샘플' 표시")
