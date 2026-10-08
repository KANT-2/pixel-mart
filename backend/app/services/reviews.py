from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, OrderItem, Review, User
from app.schemas.review import ReviewIn


class NotPurchasedError(Exception):
    """이 상품을 배송 완료로 받은 적이 없어 리뷰를 쓸 수 없음"""


class AlreadyReviewedError(Exception):
    """이미 이 상품에 리뷰를 작성함"""


def round_average(total: int, count: int) -> float | None:
    """평균 별점(소수 첫째 자리). 리뷰가 없으면 None. DB 없이 테스트할 수 있는 순수 함수"""
    return round(total / count, 1) if count else None


async def find_delivered_item(db: AsyncSession, user: User, product_id: int) -> OrderItem | None:
    """내가 이 상품을 '배송 완료'로 받은 주문 품목 (배송 전·취소된 주문은 제외)"""
    return await db.scalar(
        select(OrderItem)
        .join(Order, Order.id == OrderItem.order_id)
        .where(Order.user_id == user.id, Order.status == "delivered", OrderItem.product_id == product_id)
        .order_by(Order.id)
        .limit(1)
    )


async def create_review(db: AsyncSession, user: User, product_id: int, body: ReviewIn) -> Review:
    item = await find_delivered_item(db, user, product_id)
    if item is None:
        raise NotPurchasedError

    exists = await db.scalar(select(Review.id).where(Review.user_id == user.id, Review.product_id == product_id))
    if exists is not None:
        raise AlreadyReviewedError

    review = Review(
        user_id=user.id, product_id=product_id, order_item_id=item.id, rating=body.rating, content=body.content
    )
    db.add(review)
    try:
        await db.commit()
    except IntegrityError:  # 동시에 두 번 눌러도 DB의 중복 방지 규칙이 막아 준다
        await db.rollback()
        raise AlreadyReviewedError from None

    # id·created_at 같은 DB가 채운 값과 작성자(닉네임)를 읽어 온다
    return await db.scalar(select(Review).where(Review.id == review.id).execution_options(populate_existing=True))


async def list_reviews(
    db: AsyncSession, product_id: int, page: int, size: int
) -> tuple[list[Review], int, float | None]:
    """(이번 페이지 리뷰, 전체 개수, 평균 별점) — 최신순"""
    total, rating_sum = (
        await db.execute(
            select(func.count(Review.id), func.coalesce(func.sum(Review.rating), 0)).where(
                Review.product_id == product_id
            )
        )
    ).one()
    rows = await db.scalars(
        select(Review)
        .where(Review.product_id == product_id)
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return list(rows), total, round_average(rating_sum, total)
