from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import DbSession
from app.models import Keyboard, Product
from app.schemas.compat import CompatibilityOut, KeyboardOut
from app.services.compat import check_compatibility, get_keycap_spec, list_keyboards

router = APIRouter(tags=["compatibility"])


@router.get("/keyboards", response_model=list[KeyboardOut], summary="키보드 모델 검색 (Mock 데이터)")
async def get_keyboards(
    db: DbSession,
    maker: Annotated[str | None, Query(max_length=50, description="제조사 (정확히 일치, 대소문자 무시)")] = None,
    q: Annotated[str | None, Query(max_length=50, description="제조사·모델명 검색어")] = None,
):
    return [KeyboardOut.from_model(k) for k in await list_keyboards(db, maker, q)]


@router.get(
    "/compatibility", response_model=CompatibilityOut, summary="키보드와 키캡 상품의 호환 결과 (키별 호환/일부/불가)"
)
async def get_compatibility(
    db: DbSession,
    keyboard_id: Annotated[int, Query(alias="keyboardId")],
    product_id: Annotated[int, Query(alias="productId")],
):
    keyboard = await db.get(Keyboard, keyboard_id)
    if keyboard is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "키보드를 찾을 수 없습니다.")
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")
    spec = await get_keycap_spec(db, product_id)
    if spec is None:  # 키캡이 아닌 상품은 규격이 없다
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "키캡 상품만 호환성을 확인할 수 있습니다.")

    verdict = check_compatibility(keyboard, spec)
    return CompatibilityOut(
        keyboard=KeyboardOut.from_model(keyboard),
        product_id=product.id,
        product_name=product.name,
        checks=verdict.checks,
        result=verdict.result,
        result_label=verdict.result_label,
        summary=verdict.summary,
    )
