from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DbSession, OptionalUser
from app.models import Category, Product, User, Wishlist
from app.schemas.common import Page
from app.schemas.product import CategoryOut, ProductWithWishOut, RarityOut
from app.services.rarity import BY_KEY, TIERS, price_condition
from app.services.search import LIKE_ESCAPE, like_pattern

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


def category_filter(category: str | None) -> list:
    slugs = [s.strip() for s in (category or "").split(",") if s.strip()]
    return [Product.category_slug.in_(slugs)] if slugs else []


@router.get("/rarities", response_model=list[RarityOut], summary="등급별 카테고리 (가격대 등급 · 상품 개수)")
async def list_rarities(
    db: DbSession,
    category: Annotated[str | None, Query(max_length=200, description="이 카테고리 안에서만 개수 세기")] = None,
):
    filters = category_filter(category)
    out = []
    for tier in TIERS:
        count = await db.scalar(select(func.count()).select_from(Product).where(*filters, price_condition(tier))) or 0
        out.append(
            RarityOut(key=tier.key, label=tier.label, min_price=tier.min_price, max_price=tier.max_price, count=count)
        )
    return out


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
    rarity: Annotated[
        str | None, Query(max_length=60, description="등급, 쉼표로 여러 개 (common,rare,epic,unique)")
    ] = None,
    sort: Literal["id", "new", "price_asc", "price_desc", "popular"] = "id",
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
):
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "최소 가격이 최대 가격보다 클 수 없습니다.")

    filters = category_filter(category)
    if rarity:
        keys = [k.strip().lower() for k in rarity.split(",") if k.strip()]
        if unknown := [k for k in keys if k not in BY_KEY]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"알 수 없는 등급입니다: {', '.join(unknown)}")
        if keys:
            filters.append(or_(*(price_condition(BY_KEY[k]) for k in keys)))
    if q:
        # %·_를 와일드카드가 아니라 글자로 찾는다 (#83)
        keyword = like_pattern(q.strip())
        filters.append(
            or_(Product.name.ilike(keyword, escape=LIKE_ESCAPE), Product.description.ilike(keyword, escape=LIKE_ESCAPE))
        )
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
