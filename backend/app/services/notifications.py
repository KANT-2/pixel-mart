"""앱 안 알림 — 교환 신청·주문·선물·활동 점수·하트·뱃지

모든 함수는 커밋하지 않는다 (부르는 쪽 트랜잭션과 함께 저장). 같은 일(kind + ref_key)은 한 번만 쌓인다.
샘플 작성자에게는 보내지 않고, 데모 이웃(@demo.pixelmart.test)에게는 보낸다.
"""

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification, User
from app.services import activity, badges

# 위시맵·거래 Mock 글의 가짜 작성자 (scripts/seed_local.py)
SAMPLE_EMAIL = "sample@pixelmart.local"

TRADES_HREF = "/local/trades/mine#trade-requests"
GIFTS_HREF = "/mypage/gifts"
QUESTS_HREF = "/mypage/quests"
BADGES_HREF = "/mypage"


async def _real_user(db: AsyncSession, user_id: int) -> User | None:
    user = await db.get(User, user_id)
    return None if user is None or user.email == SAMPLE_EMAIL else user


async def notify(
    db: AsyncSession, user_id: int, kind: str, title: str, body: str, href: str | None = None, ref_key: str = ""
) -> None:
    """알림 하나 추가 — 이미 같은 알림이 있으면 조용히 건너뛴다"""
    if await _real_user(db, user_id) is None:
        return
    await db.execute(
        insert(Notification)
        .values(user_id=user_id, kind=kind, title=title[:80], body=body[:200], href=href, ref_key=ref_key[:120])
        .on_conflict_do_nothing(index_elements=["user_id", "kind", "ref_key"])
    )


async def snapshot(db: AsyncSession, user_id: int) -> badges.Stats | None:
    """하트·뱃지 비교용 지금 기록 (샘플 작성자는 None)"""
    user = await _real_user(db, user_id)
    if user is None:
        return None
    return (await badges.stats_for(db, [user]))[user_id]


async def notify_progress(db: AsyncSession, user_id: int, before: badges.Stats | None) -> None:
    """before 이후 하트가 늘었거나 새 뱃지를 받았으면 알린다"""
    if before is None:
        return
    after = await snapshot(db, user_id)
    if after is None:
        return
    if after.hearts > before.hearts:
        hearts = after.hearts
        await notify(
            db,
            user_id,
            "heart_up",
            f"하트가 늘었어요 ♥×{hearts}",
            f"LV.{activity.level_number(hearts)} {activity.level_title(hearts)}",
            QUESTS_HREF,
            f"heart:{hearts}",
        )
    had = {b.code for b in badges.earned(before)}
    for badge in badges.earned(after):
        if badge.code not in had:
            await notify(
                db,
                user_id,
                "badge",
                f"뱃지 획득! {badge.name}",
                badge.description,
                BADGES_HREF,
                f"badge:{badge.code}",
            )


async def points_awarded(db: AsyncSession, user_id: int, kind: str, ref_id: int, before: badges.Stats | None) -> None:
    """activity.award 성공 직후 — 점수·하트·뱃지 알림"""
    if before is None:
        return
    rule = activity.RULES[kind]
    await notify(db, user_id, "points", f"활동 점수 +{rule.points}", rule.label, QUESTS_HREF, f"pt:{kind}:{ref_id}")
    await notify_progress(db, user_id, before)
