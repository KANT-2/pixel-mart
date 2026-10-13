"""PIXEL LOCAL 교환 신청 — 신청 → 글 주인 수락(교환 진행) → 두 사람 모두 "받았어요" → 완료

이웃의 HAVE·WANT 글에는 내 교환글(HAVE)의 물건을 골라 함께 보내야 한다. 실제 주고받는 방식(택배·직거래)은 아직 없다.
"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import TradePost, TradeRequest
from app.routers.local_trades import post_out
from app.schemas.local import TradeAuthorOut, TradeRequestIn, TradeRequestOut
from app.services import activity, notifications
from app.services.regions import RegionTree, load_tree

router = APIRouter(prefix="/local/trade-requests", tags=["local"])

NOT_FOUND = "교환 신청을 찾을 수 없습니다."


def request_out(req: TradeRequest, tree: RegionTree, viewer_id: int) -> TradeRequestOut:
    requester = req.requester
    owner_view = req.post.user_id == viewer_id
    mine, theirs = (
        (req.owner_received_at, req.requester_received_at)
        if owner_view
        else (req.requester_received_at, req.owner_received_at)
    )
    return TradeRequestOut(
        id=req.id,
        status=req.status,
        created_at=req.created_at,
        decided_at=req.decided_at,
        received_by_me=mine is not None,
        received_by_them=theirs is not None,
        post=post_out(req.post, tree, viewer_id),
        offer_post=post_out(req.offer_post, tree, viewer_id) if req.offer_post else None,
        is_mine=req.requester_id == viewer_id,
        requester=TradeAuthorOut(nickname=requester.nickname, avatar_url=requester.avatar_url)
        if requester.nickname_public
        else None,
    )


async def load_request(db: DbSession, request_id: int) -> TradeRequest | None:
    # 상태를 바꾼 뒤 다시 읽을 때 연결된 글 상태도 새로 가져온다
    return await db.scalar(
        select(TradeRequest).where(TradeRequest.id == request_id).execution_options(populate_existing=True)
    )


async def pending_for(db: DbSession, request_id: int, owner_id: int | None = None, requester_id: int | None = None):
    """남의 신청은 404로 숨기고, 이미 처리된 신청은 400"""
    req = await load_request(db, request_id)
    if (
        req is None
        or (owner_id is not None and req.post.user_id != owner_id)
        or (requester_id is not None and req.requester_id != requester_id)
    ):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    if req.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 처리된 신청이에요.")
    return req


async def respond(db: DbSession, req: TradeRequest, viewer_id: int) -> TradeRequestOut:
    await db.commit()
    return request_out(await load_request(db, req.id), await load_tree(db), viewer_id)


async def _notify_decided(db: DbSession, req: TradeRequest) -> None:
    """신청한 사람에게 수락·거절 결과 알림"""
    if req.status == "accepted":
        title, body = (
            "교환 신청이 수락됐어요",
            f"{req.post.item_name} 교환이 시작됐어요. 물건을 받으면 '받았어요'를 눌러 주세요.",
        )
    else:
        title, body = "교환 신청이 거절됐어요", f"{req.post.item_name} 교환은 이번엔 어렵대요."
    await notifications.notify(
        db, req.requester_id, f"trade_{req.status}", title, body, notifications.TRADES_HREF, f"tr:{req.id}:{req.status}"
    )


@router.post(
    "", response_model=TradeRequestOut, status_code=status.HTTP_201_CREATED, summary="이웃의 거래글에 교환 신청"
)
async def create_request(body: TradeRequestIn, user: CurrentUser, db: DbSession):
    post = await db.get(TradePost, body.post_id)
    if post is None or post.status == "hidden":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "거래글을 찾을 수 없습니다.")
    if post.user_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "내 글에는 교환을 신청할 수 없어요.")
    if post.is_sample:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "샘플 글에는 교환을 신청할 수 없어요.")
    if post.status != "open":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 마감된 글이에요.")
    # 교환은 내가 올린 교환글(HAVE)의 물건으로만 — 판매 글에는 물건 없이 구매 신청도 된다
    if body.offer_post_id is None and post.kind != "sell":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "교환할 내 물건(HAVE 글)을 골라 주세요.")
    if body.offer_post_id is not None:
        offer = await db.get(TradePost, body.offer_post_id)
        if offer is None or offer.user_id != user.id or offer.status != "open" or offer.kind != "have":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "내 진행 중인 교환글(HAVE)의 물건만 보낼 수 있어요.")
    duplicate = await db.scalar(
        select(TradeRequest.id).where(
            TradeRequest.post_id == post.id, TradeRequest.requester_id == user.id, TradeRequest.status == "pending"
        )
    )
    if duplicate is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 교환을 신청했어요.")

    req = TradeRequest(post_id=post.id, requester_id=user.id, offer_post_id=body.offer_post_id)
    db.add(req)
    await db.flush()
    await notifications.notify(
        db,
        post.user_id,
        "trade_request",
        "새 교환 신청이 왔어요",
        f"{post.item_name}에 교환 신청이 도착했어요.",
        notifications.TRADES_HREF,
        f"tr:{req.id}",
    )
    return await respond(db, req, user.id)


@router.get("", response_model=list[TradeRequestOut], summary="교환 신청함 (box=received 받은 신청 / sent 보낸 신청)")
async def list_requests(user: CurrentUser, db: DbSession, box: Literal["received", "sent"] = "received"):
    query = select(TradeRequest).order_by(TradeRequest.created_at.desc(), TradeRequest.id.desc())
    if box == "received":
        query = query.join(TradePost, TradePost.id == TradeRequest.post_id).where(TradePost.user_id == user.id)
    else:
        query = query.where(TradeRequest.requester_id == user.id)
    tree = await load_tree(db)
    return [request_out(r, tree, user.id) for r in await db.scalars(query)]


@router.post(
    "/{request_id}/accept", response_model=TradeRequestOut, summary="받은 신청 수락 — 교환 진행 시작, 두 글은 마감"
)
async def accept_request(request_id: int, user: CurrentUser, db: DbSession):
    req = await pending_for(db, request_id, owner_id=user.id)
    now = datetime.now(UTC)
    req.status, req.decided_at = "accepted", now
    req.post.status = "done"
    if req.offer_post is not None and req.offer_post.status == "open":
        req.offer_post.status = "done"
    # 같은 글에 들어온 다른 신청은 자동으로 거절
    others = await db.scalars(
        select(TradeRequest).where(
            TradeRequest.post_id == req.post_id, TradeRequest.id != req.id, TradeRequest.status == "pending"
        )
    )
    for other in others:
        other.status, other.decided_at = "declined", now
        await _notify_decided(db, other)
    await _notify_decided(db, req)
    return await respond(db, req, user.id)


@router.post(
    "/{request_id}/received",
    response_model=TradeRequestOut,
    summary="교환 진행 중 물건을 받았어요 — 두 사람 모두 누르면 완료·거래 완료 점수",
)
async def mark_received(request_id: int, user: CurrentUser, db: DbSession):
    req = await load_request(db, request_id)
    if req is None or user.id not in (req.post.user_id, req.requester_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    if req.status != "accepted":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "교환 진행 중인 신청만 받음 확인을 할 수 있어요.")
    owner_view = req.post.user_id == user.id
    if (req.owner_received_at if owner_view else req.requester_received_at) is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 받았다고 알렸어요.")
    now = datetime.now(UTC)
    if owner_view:
        req.owner_received_at = now
    else:
        req.requester_received_at = now
    other_id = req.requester_id if owner_view else req.post.user_id
    if req.owner_received_at is None or req.requester_received_at is None:
        await notifications.notify(
            db,
            other_id,
            "trade_received",
            "상대가 물건을 받았어요",
            f"{req.post.item_name} 교환 — 나도 받으면 '받았어요'를 눌러 교환을 끝내 주세요.",
            notifications.TRADES_HREF,
            f"tr:{req.id}:received:{user.id}",
        )
        return await respond(db, req, user.id)

    # 두 사람 모두 받음 → 교환 완료. 거래 완료 점수는 이때 준다 (수락만으로 점수를 올리지 못하게)
    before = {uid: await notifications.snapshot(db, uid) for uid in (req.post.user_id, req.requester_id)}
    req.status = "completed"
    for uid in (req.post.user_id, req.requester_id):
        await activity.award(db, uid, "trade_done", req.post_id)
        await notifications.notify_progress(db, uid, before[uid])
        await notifications.notify(
            db,
            uid,
            "trade_completed",
            "교환이 끝났어요",
            f"{req.post.item_name} 교환을 마쳤어요. 동네 교환 기록이 올라갔어요.",
            notifications.TRADES_HREF,
            f"tr:{req.id}:completed",
        )
    return await respond(db, req, user.id)


@router.post("/{request_id}/decline", response_model=TradeRequestOut, summary="받은 신청 거절")
async def decline_request(request_id: int, user: CurrentUser, db: DbSession):
    req = await pending_for(db, request_id, owner_id=user.id)
    req.status, req.decided_at = "declined", datetime.now(UTC)
    await _notify_decided(db, req)
    return await respond(db, req, user.id)


@router.post("/{request_id}/cancel", response_model=TradeRequestOut, summary="보낸 신청 취소")
async def cancel_request(request_id: int, user: CurrentUser, db: DbSession):
    req = await pending_for(db, request_id, requester_id=user.id)
    req.status, req.decided_at = "cancelled", datetime.now(UTC)
    return await respond(db, req, user.id)
