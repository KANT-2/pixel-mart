from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import CartItem, Product, User
from app.schemas.cart import MAX_QUANTITY, CartItemIn, CartItemOut, CartItemUpdate, CartOut

router = APIRouter(prefix="/cart", tags=["cart"])


async def _cart_out(db: DbSession, user: User) -> CartOut:
    rows = await db.scalars(
        select(CartItem)
        .where(CartItem.user_id == user.id)
        .order_by(CartItem.added_at, CartItem.product_id)
        .execution_options(populate_existing=True)
    )
    items = [CartItemOut.from_model(item) for item in rows]
    return CartOut(
        items=items,
        total_quantity=sum(i.quantity for i in items),
        total_price=sum(i.subtotal for i in items),
    )


async def _get_item(db: DbSession, user: User, product_id: int) -> CartItem:
    item = await db.get(CartItem, (user.id, product_id))
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "장바구니에 없는 상품입니다.")
    return item


@router.get("", response_model=CartOut)
async def get_cart(user: CurrentUser, db: DbSession):
    return await _cart_out(db, user)


@router.post("/items", response_model=CartOut, summary="담기 (이미 있으면 수량 더하기)")
async def add_item(body: CartItemIn, user: CurrentUser, db: DbSession):
    if await db.get(Product, body.product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")

    item = await db.get(CartItem, (user.id, body.product_id))
    if item is None:
        db.add(CartItem(user_id=user.id, product_id=body.product_id, quantity=body.quantity))
    elif item.quantity + body.quantity > MAX_QUANTITY:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"한 상품은 최대 {MAX_QUANTITY}개까지 담을 수 있습니다.")
    else:
        item.quantity += body.quantity
    await db.commit()
    return await _cart_out(db, user)


@router.patch("/items/{product_id}", response_model=CartOut, summary="수량 변경")
async def update_item(product_id: int, body: CartItemUpdate, user: CurrentUser, db: DbSession):
    item = await _get_item(db, user, product_id)
    item.quantity = body.quantity
    await db.commit()
    return await _cart_out(db, user)


@router.delete("/items/{product_id}", response_model=CartOut, summary="삭제")
async def delete_item(product_id: int, user: CurrentUser, db: DbSession):
    item = await _get_item(db, user, product_id)
    await db.delete(item)
    await db.commit()
    return await _cart_out(db, user)
