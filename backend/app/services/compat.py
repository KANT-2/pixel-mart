from dataclasses import dataclass

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Keyboard, KeycapSpec
from app.schemas.compat import CompatCheckOut, Status

RESULT_LABELS: dict[str, str] = {
    "compatible": "모두 장착 가능",
    "partial": "일부 호환",
    "incompatible": "장착 불가",
}


@dataclass(frozen=True)
class Verdict:
    checks: list[CompatCheckOut]
    result: Status
    summary: str

    @property
    def result_label(self) -> str:
        return RESULT_LABELS[self.result]


def _check(key: str, label: str, ok: bool, ok_msg: str, ng_msg: str, ng_status: Status = "incompatible"):
    return CompatCheckOut(
        key=key, label=label, status="compatible" if ok else ng_status, message=ok_msg if ok else ng_msg
    )


def _key_check(token: str, keyboard: Keyboard) -> CompatCheckOut:
    """키캡이 덮는 키 한 종류(token)가 이 키보드에 맞는지"""
    if token == "1u":
        return _check("keys", "일반 키(1u)", True, "어느 1u 키에나 꽂을 수 있어요.", "")
    if token == "accent4":
        return _check("keys", "포인트 키(1u 4개)", True, "1u 키 4개에 꽂을 수 있어요.", "")
    if token == "esc":
        return _check(
            "esc",
            "ESC 키",
            keyboard.esc_size == "1u",
            "ESC 키 크기(1u)가 맞아요.",
            f"이 키보드의 ESC 키는 {keyboard.esc_size}라 1u 키캡이 맞지 않아요.",
        )
    if token == "6.25u":
        return _check(
            "spacebar",
            "스페이스바",
            keyboard.spacebar_size == "6.25u",
            "스페이스바 크기(6.25u)가 맞아요.",
            f"이 키보드의 스페이스바는 {keyboard.spacebar_size}라 6.25u 키캡이 맞지 않아요.",
        )
    if token == "arrows":
        return _check(
            "arrows",
            "방향키",
            keyboard.has_arrow_cluster,
            "방향키 블록이 있어서 장착할 수 있어요.",
            "이 키보드에는 방향키 블록이 없어요.",
        )
    raise ValueError(f"알 수 없는 키 종류입니다: {token}")  # 시드 데이터 오타를 일찍 발견하기 위해


def check_compatibility(keyboard: Keyboard, spec: KeycapSpec) -> Verdict:
    """키보드와 키캡 규격을 비교해 항목별 결과와 최종 결과를 돌려준다. DB 없이 테스트할 수 있는 순수 함수"""
    stem = _check(
        "stem",
        "축(Stem)",
        keyboard.stem == spec.stem,
        f"{spec.stem} 축이 같아요.",
        f"키보드는 {keyboard.stem} 축, 키캡은 {spec.stem} 축이라 꽂을 수 없어요.",
    )
    profile = _check(
        "profile",
        "프로파일",
        spec.profile in keyboard.profile_support,
        f"{spec.profile} 프로파일을 지원해요.",
        f"이 키보드는 {spec.profile} 프로파일을 지원하지 않아 높이·모양이 다를 수 있어요.",
        ng_status="partial",
    )
    keys = [_key_check(token, keyboard) for token in spec.key_sizes]
    checks = [stem, profile, *keys]

    if stem.status == "incompatible":
        return Verdict(checks, "incompatible", "스위치 축이 달라 장착할 수 없어요.")
    bad_keys = [k for k in keys if k.status == "incompatible"]
    if bad_keys and len(bad_keys) == len(keys):
        return Verdict(checks, "incompatible", "이 키보드에는 맞지 않는 키캡이에요.")
    if bad_keys:
        return Verdict(checks, "partial", "일부 키만 장착할 수 있어요.")
    if profile.status == "partial":
        return Verdict(checks, "partial", "장착은 되지만 키캡 높이·모양이 달라 보일 수 있어요.")
    return Verdict(checks, "compatible", "이 키보드에 장착할 수 있어요.")


async def list_keyboards(db: AsyncSession, maker: str | None, q: str | None) -> list[Keyboard]:
    stmt = select(Keyboard).order_by(Keyboard.maker, Keyboard.model)
    if maker:
        stmt = stmt.where(Keyboard.maker.ilike(maker.strip()))
    if q and q.strip():
        keyword = f"%{q.strip()}%"
        stmt = stmt.where(or_(Keyboard.maker.ilike(keyword), Keyboard.model.ilike(keyword)))
    return list(await db.scalars(stmt))


async def get_keycap_spec(db: AsyncSession, product_id: int) -> KeycapSpec | None:
    return await db.get(KeycapSpec, product_id)
