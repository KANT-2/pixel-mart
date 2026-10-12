from math import ceil
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.core.config import settings
from app.deps import CurrentUser, DbSession, OptionalUser
from app.models import Product
from app.schemas.common import Page
from app.schemas.question import AnswerIn, QuestionIn, QuestionOut
from app.services.questions import (
    AlreadyAnsweredError,
    answer_question,
    create_question,
    get_question,
    list_questions,
)

router = APIRouter(prefix="/products/{product_id}/questions", tags=["questions"])
dev_router = APIRouter(prefix="/dev/questions", tags=["dev"])


async def _require_product(db: DbSession, product_id: int) -> None:
    if await db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")


@router.get("", response_model=Page[QuestionOut], summary="상품 문의 목록 (비밀글은 작성자만 내용을 봄, 최신순)")
async def get_questions(
    product_id: int,
    db: DbSession,
    user: OptionalUser,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
):
    await _require_product(db, product_id)
    rows, total = await list_questions(db, product_id, page, size)
    viewer_id = user.id if user else None
    return Page[QuestionOut](
        items=[QuestionOut.from_model(q, viewer_id) for q in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED, summary="문의 작성")
async def post_question(product_id: int, body: QuestionIn, user: CurrentUser, db: DbSession):
    await _require_product(db, product_id)
    question = await create_question(db, user, product_id, body)
    return QuestionOut.from_model(question, user.id)


@dev_router.post("/{question_id}/answer", response_model=QuestionOut, summary="[로컬 전용] 문의에 답변 달기")
async def answer(question_id: int, body: AnswerIn, user: CurrentUser, db: DbSession):
    # 판매자 화면이 없어서 로컬에서는 로그인한 누구나 답변을 달 수 있다
    if not settings.is_local:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    question = await get_question(db, question_id)
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "문의를 찾을 수 없습니다.")
    try:
        question = await answer_question(db, question, body.answer)
    except AlreadyAnsweredError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 답변이 달린 문의입니다.") from None
    # 비밀글 내용은 작성자가 아닌 사람에게 돌려주지 않는다
    return QuestionOut.from_model(question, user.id)
