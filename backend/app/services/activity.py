"""PIXEL LOCAL 활동 점수 — 하트(지역 커뮤니티 참여도)·코인(완료한 교환·거래)

시범 정책이라 팀이 기준을 정하면 숫자만 바꾼다. 하트는 거래 횟수나 받은 선물 수가 아니라 '연결·기여 활동'으로 채우고,
같은 일은 한 번만, 반복 활동은 하루 상한까지만 적립한다.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityPoint


@dataclass(frozen=True)
class Rule:
    label: str
    points: int
    # None이면 평생 한 번, 숫자면 하루 최대 횟수
    daily_cap: int | None


RULES: dict[str, Rule] = {
    "profile": Rule("지역·취향 프로필 처음 완성", 5, None),
    "first_want": Rule("첫 WANT 등록", 10, None),
    "trade_done": Rule("거래·교환 정상 완료", 20, 3),
    "gift_sent": Rule("선물 보내기 완료", 10, 3),
    "contribution": Rule("유효한 커뮤니티 기여", 5, 5),
}

# 하트 1·2·3개가 되는 점수 (예: 65점 하트 2개, 90점 하트 3개)
HEART_STEPS = (30, 65, 90)
# 하트 3개부터는 30점마다 하나씩, 최대 99개 (화면은 하트 3개 + "+N")
EXTRA_HEART_EVERY = 30
MAX_HEARTS = 99
LEVEL_TITLES = ("새내기 이웃", "동네 이웃", "친한 이웃", "단골 이웃")
# 다른 사람에게는 완료한 교환·거래 수를 정확히 보이지 않고 구간으로만
COIN_BANDS = (100, 50, 30, 10, 5, 1)


def hearts_for(score: int) -> int:
    if score < HEART_STEPS[-1]:
        return sum(score >= step for step in HEART_STEPS)
    return min(MAX_HEARTS, len(HEART_STEPS) + (score - HEART_STEPS[-1]) // EXTRA_HEART_EVERY)


def level_title(hearts: int) -> str:
    return LEVEL_TITLES[min(hearts, len(LEVEL_TITLES) - 1)]


def next_heart_at(score: int) -> int | None:
    """다음 하트가 되는 점수 (하트가 99개면 None)"""
    hearts = hearts_for(score)
    if hearts >= MAX_HEARTS:
        return None
    if hearts < len(HEART_STEPS):
        return HEART_STEPS[hearts]
    return HEART_STEPS[-1] + (hearts - len(HEART_STEPS) + 1) * EXTRA_HEART_EVERY


def coin_band(coins: int) -> str | None:
    return next((f"교환 {band}회+" for band in COIN_BANDS if coins >= band), None)


async def award(db: AsyncSession, user_id: int, kind: str, ref_id: int = 0, now: datetime | None = None) -> bool:
    """점수 적립 (커밋은 부르는 쪽에서). 이미 받은 일이거나 하루 상한이면 False"""
    rule = RULES[kind]
    if rule.daily_cap is None:
        ref_id = 0
    exists = await db.scalar(
        select(ActivityPoint.id).where(
            ActivityPoint.user_id == user_id, ActivityPoint.kind == kind, ActivityPoint.ref_id == ref_id
        )
    )
    if exists is not None:
        return False
    if rule.daily_cap is not None:
        since = (now or datetime.now(UTC)) - timedelta(days=1)
        today = await db.scalar(
            select(func.count()).where(
                ActivityPoint.user_id == user_id, ActivityPoint.kind == kind, ActivityPoint.created_at >= since
            )
        )
        if today >= rule.daily_cap:
            return False
    db.add(ActivityPoint(user_id=user_id, kind=kind, ref_id=ref_id, points=rule.points))
    await db.flush()
    return True


async def totals(db: AsyncSession, user_ids: list[int]) -> dict[int, tuple[int, int]]:
    """사용자별 (점수, 코인=완료한 교환·거래 수)"""
    if not user_ids:
        return {}
    rows = await db.execute(
        select(
            ActivityPoint.user_id,
            func.sum(ActivityPoint.points),
            func.count().filter(ActivityPoint.kind == "trade_done"),
        )
        .where(ActivityPoint.user_id.in_(user_ids))
        .group_by(ActivityPoint.user_id)
    )
    return {user_id: (int(score), int(coins)) for user_id, score, coins in rows}
