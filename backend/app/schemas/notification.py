from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class NotificationOut(CamelModel):
    id: int
    kind: str
    title: str
    body: str
    href: str | None
    created_at: datetime
    read: bool


class NotificationListOut(CamelModel):
    items: list[NotificationOut]
    unread: int


class UnreadOut(CamelModel):
    unread: int


class ReadIn(CamelModel):
    # 비우면(null) 안 읽은 알림 전부
    ids: list[int] | None = Field(default=None, max_length=200)
