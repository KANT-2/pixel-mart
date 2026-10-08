from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import DbSession
from app.models import Faq
from app.schemas.faq import FaqOut

router = APIRouter(tags=["faqs"])


@router.get("/faqs", response_model=list[FaqOut])
async def list_faqs(
    db: DbSession,
    category: Annotated[str | None, Query(max_length=30, description="분류 (예: 배송)")] = None,
):
    stmt = select(Faq).order_by(Faq.sort_order, Faq.id)
    if category:
        stmt = stmt.where(Faq.category == category)
    return (await db.scalars(stmt)).all()
