from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProductQuestion, User
from app.schemas.question import QuestionIn


class AlreadyAnsweredError(Exception):
    """이미 답변이 달린 문의"""


async def get_question(db: AsyncSession, question_id: int) -> ProductQuestion | None:
    return await db.scalar(
        select(ProductQuestion).where(ProductQuestion.id == question_id).execution_options(populate_existing=True)
    )


async def create_question(db: AsyncSession, user: User, product_id: int, body: QuestionIn) -> ProductQuestion:
    question = ProductQuestion(
        product_id=product_id,
        user_id=user.id,
        title=body.title,
        content=body.content,
        is_secret=body.is_secret,
    )
    db.add(question)
    await db.commit()
    # id·created_at 같은 DB가 채운 값과 작성자(닉네임)를 읽어 온다
    return await get_question(db, question.id)


async def list_questions(db: AsyncSession, product_id: int, page: int, size: int) -> tuple[list[ProductQuestion], int]:
    """(이번 페이지 문의, 전체 개수) — 최신순. 비밀글 가리기는 스키마(QuestionOut)가 한다"""
    total = await db.scalar(select(func.count(ProductQuestion.id)).where(ProductQuestion.product_id == product_id))
    rows = await db.scalars(
        select(ProductQuestion)
        .where(ProductQuestion.product_id == product_id)
        .order_by(ProductQuestion.created_at.desc(), ProductQuestion.id.desc())
        .offset((page - 1) * size)
        .limit(size)
        .execution_options(populate_existing=True)
    )
    return list(rows), total or 0


async def answer_question(db: AsyncSession, question: ProductQuestion, answer: str) -> ProductQuestion:
    """답변과 답변 시각을 저장한다 (문의당 답변은 한 번만)"""
    if question.answer is not None:
        raise AlreadyAnsweredError
    question.answer = answer
    question.answered_at = datetime.now(UTC)
    await db.commit()
    return await get_question(db, question.id)
