"""활동 뱃지 — 따로 저장하지 않고 지금 있는 기록(주문·리뷰·활동 점수·거래·선물)으로 계산한다

새 테이블·마이그레이션이 없어서 기준을 바꾸면 바로 모두에게 반영된다. 받은 날짜는 남기지 않는다.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ActivityPoint, Gift, Order, OrderItem, Product, Review, TradePost, User
from app.services import activity, local_stats
from app.services.rarity import BY_KEY
from app.services.trade_rules import DEMO_EMAIL_DOMAIN


@dataclass(frozen=True)
class Badge:
    code: str
    icon: str
    name: str
    description: str
    # 이웃 카드의 대표 뱃지 — 받기 어려운 뱃지일수록 크다
    rank: int

    @property
    def image(self) -> str:
        """16×16 픽셀 아이콘 (public/images/badges — tools/gen_badges.py)"""
        return f"/images/badges/{self.code}.png"


@dataclass
class Stats:
    """뱃지 계산에 쓰는 사용자 기록 요약"""

    profile: bool = False
    map_debut: bool = False
    orders: int = 0
    unique: bool = False
    categories: int = 0
    reviews: int = 0
    first_want: bool = False
    trades: int = 0
    gifts: int = 0
    wish_done: bool = False
    hearts: int = 0
    top_buyer: bool = False


# 도감에 보이는 순서
BADGES: tuple[Badge, ...] = (
    Badge("new_player", "🎮", "첫 접속", "PIXEL MART에 가입", 1),
    Badge("local", "🗺️", "동네 등록", "지역·취향 프로필 완성", 2),
    Badge("map_debut", "👾", "지도 데뷔", "픽셀 아바타로 덕력지도에 등장", 3),
    Badge("first_order", "🛒", "첫 장착", "첫 주문 (취소 제외)", 4),
    Badge("first_want", "💌", "첫 WANT", "갖고 싶은 아이템 WANT 글 첫 등록", 5),
    Badge("first_trade", "🤝", "첫 거래", "동네 교환·거래 1회 완료", 6),
    Badge("reviewer", "✍️", "리뷰어", "리뷰 3개 작성", 7),
    Badge("collector", "🎒", "컬렉터", "서로 다른 카테고리 상품 4가지 구매", 8),
    Badge("santa", "🎁", "동네 산타", "이웃에게 선물 3번 전달", 9),
    Badge("wish_done", "✨", "소원 성취", "내 WANT가 선물이나 거래로 이루어짐", 10),
    Badge("unique_hunter", "💎", "유니크 헌터", "UNIQUE 등급 아이템 구매", 11),
    Badge("regular", "🏠", "단골 이웃", "하트 3개 달성", 12),
    Badge("trader_1", "🪙", "교환 장인 Ⅰ", "교환·거래 10회 완료", 13),
    Badge("hearts_1", "🏆", "하트 수집가 Ⅰ", "하트 10개 달성", 14),
    Badge("trader_2", "🪙", "교환 장인 Ⅱ", "교환·거래 30회 완료", 15),
    Badge("top_buyer", "👑", "동네 큰손", "지난주 우리 동네 구매 1위 — 매주 월요일에 바뀜 (금액 비공개)", 16),
    Badge("hearts_2", "🏆", "하트 수집가 Ⅱ", "하트 50개 달성", 17),
    Badge("trader_3", "🪙", "교환 장인 Ⅲ", "교환·거래 100회 완료", 18),
    Badge("hearts_3", "🏆", "하트 수집가 Ⅲ", "하트 99개 달성", 19),
)
BY_CODE: dict[str, Badge] = {b.code: b for b in BADGES}
KST = timezone(timedelta(hours=9))


def last_week(now: datetime | None = None) -> tuple[datetime, datetime]:
    """지난주 월요일 0시 ~ 이번 주 월요일 0시 (한국 시간) — 동네 큰손은 이 기간 구매로 매주 다시 정한다"""
    local = (now or datetime.now(UTC)).astimezone(KST)
    this_monday = (local - timedelta(days=local.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return this_monday - timedelta(days=7), this_monday


def earned(stats: Stats) -> list[Badge]:
    """받은 뱃지 (도감 순서)"""
    got = {
        "new_player": True,
        "local": stats.profile,
        "map_debut": stats.map_debut,
        "first_order": stats.orders >= 1,
        "first_want": stats.first_want,
        "first_trade": stats.trades >= 1,
        "reviewer": stats.reviews >= 3,
        "collector": stats.categories >= 4,
        "santa": stats.gifts >= 3,
        "wish_done": stats.wish_done,
        "unique_hunter": stats.unique,
        "regular": stats.hearts >= 3,
        "trader_1": stats.trades >= 10,
        "trader_2": stats.trades >= 30,
        "trader_3": stats.trades >= 100,
        "hearts_1": stats.hearts >= 10,
        "hearts_2": stats.hearts >= 50,
        "hearts_3": stats.hearts >= 99,
        "top_buyer": stats.top_buyer,
    }
    return [b for b in BADGES if got[b.code]]


def representative(badges: list[Badge]) -> Badge | None:
    """이웃 카드에 보일 대표 뱃지 — 가장 받기 어려운 것"""
    return max(badges, key=lambda b: b.rank, default=None)


async def stats_for(db: AsyncSession, users: list[User]) -> dict[int, Stats]:
    """여러 사용자의 기록을 한 번에 모은다 (사용자 수와 상관없이 쿼리 수는 일정)"""
    ids = [u.id for u in users]
    if not ids:
        return {}
    stats = {u.id: Stats(map_debut=bool(u.avatar_url) and u.map_avatar_opt_in) for u in users}

    for user_id, (score, coins) in (await activity.totals(db, ids)).items():
        stats[user_id].hearts = activity.hearts_for(score)
        stats[user_id].trades = coins
    kinds = await db.execute(
        select(ActivityPoint.user_id, ActivityPoint.kind, func.count())
        .where(ActivityPoint.user_id.in_(ids), ActivityPoint.kind.in_(("profile", "first_want", "gift_sent")))
        .group_by(ActivityPoint.user_id, ActivityPoint.kind)
    )
    for user_id, kind, n in kinds:
        if kind == "profile":
            stats[user_id].profile = True
        elif kind == "first_want":
            stats[user_id].first_want = True
        else:
            stats[user_id].gifts = n

    unique_from = BY_KEY["unique"].min_price
    bought = await db.execute(
        select(
            Order.user_id,
            func.count(distinct(Order.id)),
            func.count(distinct(Product.category_slug)),
            func.max(Product.price),
        )
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .where(Order.user_id.in_(ids), Order.status != "cancelled")
        .group_by(Order.user_id)
    )
    for user_id, orders, categories, top_price in bought:
        stats[user_id].orders = orders
        stats[user_id].categories = categories
        stats[user_id].unique = (top_price or 0) >= unique_from

    reviews = await db.execute(
        select(Review.user_id, func.count()).where(Review.user_id.in_(ids)).group_by(Review.user_id)
    )
    for user_id, n in reviews:
        stats[user_id].reviews = n

    # 소원 성취: 내 WANT 글이 완료됐거나, 받은 선물을 받았을 때
    wished = set(
        await db.scalars(
            select(TradePost.user_id).where(
                TradePost.user_id.in_(ids), TradePost.kind == "want", TradePost.status == "done"
            )
        )
    )
    wished |= set(
        await db.scalars(select(Gift.recipient_id).where(Gift.recipient_id.in_(ids), Gift.status == "accepted"))
    )
    for user_id in wished:
        stats[user_id].wish_done = True

    for user_id in await _top_buyers(db, {u.region_code for u in users if u.region_code}):
        if user_id in stats:
            stats[user_id].top_buyer = True
    return stats


async def _top_buyers(db: AsyncSession, regions: set[str], now: datetime | None = None) -> set[int]:
    """같은 지역(생활권)에서 지난주 구매 금액 1위 (같은 금액이면 함께) — 테스트 계정은 빼되 데모 이웃은 넣는다"""
    if not regions:
        return set()
    start, end = last_week(now)
    rows = await db.execute(
        select(User.id, User.region_code, func.sum(Order.total_price).label("total"))
        .join(Order, Order.user_id == User.id)
        .where(
            User.region_code.in_(regions),
            Order.status != "cancelled",
            Order.created_at >= start,
            Order.created_at < end,
            (User.email.not_like(f"%{local_stats.EXCLUDED_EMAIL_SUFFIX}") | User.email.like(f"%{DEMO_EMAIL_DOMAIN}")),
        )
        .group_by(User.id, User.region_code)
    )
    by_region: dict[str, list[tuple[int, int]]] = {}
    for user_id, region, total in rows:
        if total:
            by_region.setdefault(region, []).append((int(total), user_id))
    return {user_id for people in by_region.values() for total, user_id in people if total == max(t for t, _ in people)}
