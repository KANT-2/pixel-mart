from math import ceil
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.deps import CurrentUser, DbSession
from app.models import Product, Wishlist
from app.schemas.common import Message, Page
from app.schemas.wishlist import WishlistItemOut

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("", response_model=Page[WishlistItemOut], summary="내 찜 목록 (최근 찜한 순)")
async def list_wishlist(
    user: CurrentUser,
    db: DbSession,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
):
    mine = Wishlist.user_id == user.id
    total = await db.scalar(select(func.count()).select_from(Wishlist).where(mine)) or 0
    rows = await db.scalars(
        select(Wishlist)
        .where(mine)
        .order_by(Wishlist.created_at.desc(), Wishlist.product_id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    return Page[WishlistItemOut](
        items=[WishlistItemOut.from_model(w) for w in rows],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.put("/{product_id}", response_model=WishlistItemOut, summary="찜하기 (이미 찜했으면 그대로)")
async def add_wishlist(product_id: int, user: CurrentUser, db: DbSession):
    if await db.get(Product, product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")

    if await db.get(Wishlist, (user.id, product_id)) is None:
        db.add(Wishlist(user_id=user.id, product_id=product_id))
        await db.commit()
    item = await db.scalar(
        select(Wishlist)
        .where(Wishlist.user_id == user.id, Wishlist.product_id == product_id)
        .execution_options(populate_existing=True)
    )
    return WishlistItemOut.from_model(item)


@router.delete("/{product_id}", response_model=Message, summary="찜 해제")
async def remove_wishlist(product_id: int, user: CurrentUser, db: DbSession):
    item = await db.get(Wishlist, (user.id, product_id))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "찜하지 않은 상품입니다.")
    await db.delete(item)
    await db.commit()
    return Message(message="찜을 해제했습니다.")
