from datetime import datetime
from typing import Annotated

from pydantic import StringConstraints

from app.models.question import ProductQuestion
from app.schemas.common import CamelModel

# 글자 수 제한은 프론트(lib/questions.ts)의 questionLimits와 같다
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class QuestionIn(CamelModel):
    title: Title
    content: Content
    is_secret: bool = False


class AnswerIn(CamelModel):
    answer: Answer


def is_hidden(question: ProductQuestion, viewer_id: int | None) -> bool:
    """비밀글은 작성자 본인만 볼 수 있다. DB 없이 테스트할 수 있는 순수 함수"""
    return question.is_secret and question.user_id != viewer_id


class QuestionOut(CamelModel):
    """문의 한 개 — 비밀글을 남이 보면 제목·내용·닉네임·답변을 서버에서 null로 가려서 내보낸다"""

    id: int
    product_id: int
    title: str | None
    content: str | None
    nickname: str | None
    is_secret: bool
    hidden: bool
    answered: bool  # 비밀글이어도 답변 대기/완료 표시는 보인다
    answer: str | None
    answered_at: datetime | None
    created_at: datetime
    is_mine: bool = False

    @classmethod
    def from_model(cls, question: ProductQuestion, viewer_id: int | None = None) -> "QuestionOut":
        hidden = is_hidden(question, viewer_id)
        return cls(
            id=question.id,
            product_id=question.product_id,
            title=None if hidden else question.title,
            content=None if hidden else question.content,
            nickname=None if hidden else question.user.nickname,
            is_secret=question.is_secret,
            hidden=hidden,
            answered=question.answer is not None,
            answer=None if hidden else question.answer,
            answered_at=question.answered_at,
            created_at=question.created_at,
            is_mine=viewer_id is not None and question.user_id == viewer_id,
        )
