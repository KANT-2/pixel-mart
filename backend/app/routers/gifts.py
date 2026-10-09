from typing import Literal

from fastapi import APIRouter, HTTPException, status

from app.deps import CurrentUser, DbSession
from app.schemas.gift import GiftIn, GiftOut
from app.schemas.order import OrderCreate
from app.services import gifts

router = APIRouter(prefix="/gifts", tags=["gifts"])


@router.post(
    "", response_model=GiftOut, status_code=status.HTTP_201_CREATED, summary="거래글 이웃에게 선물 (데모 결제)"
)
async def send_gift(body: GiftIn, user: CurrentUser, db: DbSession):
    try:
        gift = await gifts.send_gift(db, user, body.trade_post_id, body.product_id, body.quantity, body.message)
    except gifts.GiftError as error:
        raise HTTPException(error.status, error.message) from None
    return GiftOut.from_model(gift, "sent")


@router.get("", response_model=list[GiftOut], summary="선물함 (box=received 받은 선물 / sent 보낸 선물)")
async def list_gifts(user: CurrentUser, db: DbSession, box: Literal["received", "sent"] = "received"):
    return [GiftOut.from_model(g, box) for g in await gifts.list_gifts(db, user, box)]


@router.post("/{gift_id}/accept", response_model=GiftOut, summary="받은 선물 받기 — 내 주소로 주문 생성")
async def accept_gift(gift_id: int, body: OrderCreate, user: CurrentUser, db: DbSession):
    try:
        gift = await gifts.accept_gift(db, user, gift_id, body)
    except gifts.GiftError as error:
        raise HTTPException(error.status, error.message) from None
    return GiftOut.from_model(gift, "received")


@router.post("/{gift_id}/decline", response_model=GiftOut, summary="받은 선물 거절 (보낸 사람은 데모 환불)")
async def decline_gift(gift_id: int, user: CurrentUser, db: DbSession):
    try:
        gift = await gifts.decline_gift(db, user, gift_id)
    except gifts.GiftError as error:
        raise HTTPException(error.status, error.message) from None
    return GiftOut.from_model(gift, "received")
