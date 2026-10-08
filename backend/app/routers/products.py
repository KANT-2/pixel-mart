from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DbSession, OptionalUser
from app.models import Category, Product, User, Wishlist
from app.schemas.common import Page
from app.schemas.product import CategoryOut, ProductWithWishOut

router = APIRouter(tags=["products"])

# 인기순 = 찜 많은 순 (지금 있는 데이터 중 인기를 가장 잘 나타내는 값)
WISH_COUNT = select(func.count()).select_from(Wishlist).where(Wishlist.product_id == Product.id).scalar_subquery()

SORTS = {
    "new": (Product.is_new.desc(), Product.id.desc()),
    "price_asc": (Product.price.asc(), Product.id.asc()),
    "price_desc": (Product.price.desc(), Product.id.asc()),
    "popular": (WISH_COUNT.desc(), Product.id.asc()),
    "id": (Product.id.asc(),),
}


async def wished_ids(db: DbSession, user: User | None, product_ids: list[int]) -> set[int]:
    if user is None or not product_ids:
        return set()
    rows = await db.scalars(
        select(Wishlist.product_id).where(Wishlist.user_id == user.id, Wishlist.product_id.in_(product_ids))
    )
    return set(rows)


def with_wish(product: Product, wished: set[int]) -> ProductWithWishOut:
    return ProductWithWishOut.from_model(product).model_copy(update={"is_wished": product.id in wished})


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: DbSession):
    result = await db.scalars(select(Category).order_by(Category.sort_order))
    return result.all()


@router.get("/products", response_model=Page[ProductWithWishOut])
async def list_products(
    db: DbSession,
    user: OptionalUser,
    category: Annotated[
        str | None, Query(max_length=200, description="카테고리 slug, 쉼표로 여러 개 (예: keycap,figure)")
    ] = None,
    q: Annotated[str | None, Query(max_length=50, description="상품명·설명 검색어")] = None,
    min_price: Annotated[int | None, Query(alias="minPrice", ge=0, description="최소 가격(원, 포함)")] = None,
    max_price: Annotated[int | None, Query(alias="maxPrice", ge=0, description="최대 가격(원, 포함)")] = None,
    is_new: Annotated[bool | None, Query(alias="isNew", description="true면 신상품만")] = None,
    sort: Literal["id", "new", "price_asc", "price_desc", "popular"] = "id",
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "최소 가격이 최대 가격보다 클 수 없습니다.")

    filters = []
    if category:
        slugs = [s.strip() for s in category.split(",") if s.strip()]
        filters.append(Product.category_slug.in_(slugs))
    if q:
        keyword = f"%{q.strip()}%"
        filters.append(or_(Product.name.ilike(keyword), Product.description.ilike(keyword)))
    if min_price is not None:
        filters.append(Product.price >= min_price)
    if max_price is not None:
        filters.append(Product.price <= max_price)
    if is_new is not None:
        filters.append(Product.is_new.is_(is_new))

    total = await db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
    products = (
        await db.scalars(select(Product).where(*filters).order_by(*SORTS[sort]).offset((page - 1) * size).limit(size))
    ).all()
    wished = await wished_ids(db, user, [p.id for p in products])
    return Page[ProductWithWishOut](
        items=[with_wish(p, wished) for p in products],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/products/{product_id}", response_model=ProductWithWishOut)
async def get_product(product_id: int, db: DbSession, user: OptionalUser):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")
    wished = await wished_ids(db, user, [product.id])
    return with_wish(product, wished)
