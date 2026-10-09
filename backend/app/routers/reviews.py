from math import ceil
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import CurrentUser, DbSession, OptionalUser
from app.models import Product
from app.schemas.common import Message
from app.schemas.review import ReviewIn, ReviewOut, ReviewPage
from app.services.reviews import (
    AlreadyReviewedError,
    NotPurchasedError,
    create_review,
    delete_review,
    get_user_review,
    list_reviews,
)

router = APIRouter(prefix="/products/{product_id}/reviews", tags=["reviews"])


async def _require_product(db: DbSession, product_id: int) -> None:
    if await db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")


@router.get("", response_model=ReviewPage, summary="리뷰 목록 + 평균 별점 (최신순)")
async def get_reviews(
    product_id: int,
    db: DbSession,
    user: OptionalUser,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 10,
):
    await _require_product(db, product_id)
    rows, total, average = await list_reviews(db, product_id, page, size)
    return ReviewPage(
        items=[ReviewOut.from_model(r, user.id if user else None) for r in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
        average_rating=average,
    )


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED, summary="리뷰 작성 (배송 완료 상품만)")
async def post_review(product_id: int, body: ReviewIn, user: CurrentUser, db: DbSession):
    await _require_product(db, product_id)
    try:
        review = await create_review(db, user, product_id, body)
    except NotPurchasedError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "배송이 완료된 상품만 리뷰를 작성할 수 있습니다.") from None
    except AlreadyReviewedError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 리뷰를 작성한 상품입니다.") from None
    return ReviewOut.from_model(review, user.id)


@router.delete("/{review_id}", response_model=Message, summary="내 리뷰 삭제 (삭제 후 다시 작성 가능)")
async def remove_review(product_id: int, review_id: int, user: CurrentUser, db: DbSession):
    review = await get_user_review(db, user, product_id, review_id)
    if review is None:  # 남의 리뷰도 같은 404로 숨긴다
        raise HTTPException(status.HTTP_404_NOT_FOUND, "리뷰를 찾을 수 없습니다.")
    await delete_review(db, review)
    return Message(message="리뷰를 삭제했습니다.")
