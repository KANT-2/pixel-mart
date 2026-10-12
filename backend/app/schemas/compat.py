from typing import Literal

from app.models.compat import Keyboard
from app.schemas.common import CamelModel

# 한 항목(축·프로파일·키별)과 최종 결과가 가질 수 있는 상태
Status = Literal["compatible", "partial", "incompatible"]


class KeyboardOut(CamelModel):
    id: int
    name: str  # 화면에 보여 줄 이름 (예: "Keychron K8")
    maker: str
    model: str
    layout: str
    stem: str
    profile_support: list[str]
    esc_size: str
    spacebar_size: str
    has_arrow_cluster: bool

    @classmethod
    def from_model(cls, keyboard: Keyboard) -> "KeyboardOut":
        return cls(
            id=keyboard.id,
            name=f"{keyboard.maker} {keyboard.model}",
            maker=keyboard.maker,
            model=keyboard.model,
            layout=keyboard.layout,
            stem=keyboard.stem,
            profile_support=list(keyboard.profile_support),
            esc_size=keyboard.esc_size,
            spacebar_size=keyboard.spacebar_size,
            has_arrow_cluster=keyboard.has_arrow_cluster,
        )


class CompatCheckOut(CamelModel):
    """호환성 검사 항목 한 줄 — 예: 축(Stem) 호환, 스페이스바 불가"""

    key: str  # stem, profile, esc, spacebar, arrows, keys
    label: str
    status: Status
    message: str


class CompatibilityOut(CamelModel):
    keyboard: KeyboardOut
    product_id: int
    product_name: str
    checks: list[CompatCheckOut]
    result: Status
    result_label: str  # 예: "모두 장착 가능", "일부 호환", "장착 불가"
    summary: str  # 한 줄 요약
