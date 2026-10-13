"""앱 안 알림 — 목록·안 읽은 개수(약 30초마다 폴링)·읽음 처리"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select, update

from app.deps import CurrentUser, DbSession
from app.models import Notification
from app.schemas.notification import NotificationListOut, NotificationOut, ReadIn, UnreadOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def unread_count(db: DbSession, user_id: int) -> int:
    return await db.scalar(select(func.count()).where(Notification.user_id == user_id, Notification.read_at.is_(None)))


@router.get("", response_model=NotificationListOut, summary="내 알림 (최신순)")
async def list_notifications(user: CurrentUser, db: DbSession, limit: Annotated[int, Query(ge=1, le=50)] = 30):
    rows = await db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    )
    items = [
        NotificationOut(
            id=n.id,
            kind=n.kind,
            title=n.title,
            body=n.body,
            href=n.href,
            created_at=n.created_at,
            read=n.read_at is not None,
        )
        for n in rows
    ]
    return NotificationListOut(items=items, unread=await unread_count(db, user.id))


@router.get("/unread-count", response_model=UnreadOut, summary="안 읽은 알림 개수")
async def get_unread_count(user: CurrentUser, db: DbSession):
    return UnreadOut(unread=await unread_count(db, user.id))


@router.post("/read", response_model=UnreadOut, summary="읽음 처리 (ids 없으면 전부)")
async def mark_read(body: ReadIn, user: CurrentUser, db: DbSession):
    query = update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    if body.ids is not None:
        query = query.where(Notification.id.in_(body.ids))  # 남의 알림 id는 그냥 무시
    await db.execute(query.values(read_at=datetime.now(UTC)))
    await db.commit()
    return UnreadOut(unread=await unread_count(db, user.id))
