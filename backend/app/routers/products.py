from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import DbSession
from app.models import Category, Product
from app.schemas.common import Page
from app.schemas.product import CategoryOut, ProductOut

router = APIRouter(tags=["products"])

SORTS = {
    "new": (Product.is_new.desc(), Product.id.desc()),
    "price_asc": (Product.price.asc(), Product.id.asc()),
    "price_desc": (Product.price.desc(), Product.id.asc()),
    "id": (Product.id.asc(),),
}


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: DbSession):
    result = await db.scalars(select(Category).order_by(Category.sort_order))
    return result.all()


@router.get("/products", response_model=Page[ProductOut])
async def list_products(
    db: DbSession,
    category: Annotated[str | None, Query(description="카테고리 slug (예: keycap)")] = None,
    q: Annotated[str | None, Query(max_length=50, description="상품명·설명 검색어")] = None,
    sort: Literal["id", "new", "price_asc", "price_desc"] = "id",
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
):
    filters = []
    if category:
        filters.append(Product.category_slug == category)
    if q:
        keyword = f"%{q.strip()}%"
        filters.append(or_(Product.name.ilike(keyword), Product.description.ilike(keyword)))

    total = await db.scalar(select(func.count()).select_from(Product).where(*filters)) or 0
    rows = await db.scalars(
        select(Product).where(*filters).order_by(*SORTS[sort]).offset((page - 1) * size).limit(size)
    )
    return Page[ProductOut](
        items=[ProductOut.from_model(p) for p in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/products/{product_id}", response_model=ProductOut)
async def get_product(product_id: int, db: DbSession):
    product = await db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")
    return ProductOut.from_model(product)
