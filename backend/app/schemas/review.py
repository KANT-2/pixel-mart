from datetime import datetime
from typing import Annotated

from pydantic import Field, StringConstraints

from app.models.review import Review
from app.schemas.common import CamelModel, Page

Rating = Annotated[int, Field(ge=1, le=5)]
Content = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]


class ReviewIn(CamelModel):
    rating: Rating
    content: Content


class ReviewOut(CamelModel):
    """리뷰 한 개 — 작성자는 닉네임만 보인다 (이메일은 내보내지 않는다)"""

    id: int
    product_id: int
    rating: int
    content: str
    nickname: str
    created_at: datetime

    @classmethod
    def from_model(cls, review: Review) -> "ReviewOut":
        return cls(
            id=review.id,
            product_id=review.product_id,
            rating=review.rating,
            content=review.content,
            nickname=review.user.nickname,
            created_at=review.created_at,
        )


class ReviewPage(Page[ReviewOut]):
    """리뷰 목록 + 평균 별점 (리뷰가 없으면 null)"""

    average_rating: float | None
