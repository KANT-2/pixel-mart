"""활동 뱃지 — 기준은 DB 없이, 도감 API는 로컬 DB 필요(없으면 건너뜀)"""

from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core.db import SessionLocal, engine
from app.services import badges, local_stats
from app.services.badges import BADGES, Stats, earned, last_week, representative

PUBLIC = Path(__file__).resolve().parents[2] / "public"


def codes(stats: Stats) -> set[str]:
    return {b.code for b in earned(stats)}


def test_everyone_has_new_player_badge():
    assert codes(Stats()) == {"new_player"}
    assert representative(earned(Stats())).code == "new_player"


@pytest.mark.parametrize(
    ("stats", "has", "has_not"),
    [
        (Stats(trades=9), {"first_trade"}, {"trader_1"}),
        (Stats(trades=10), {"first_trade", "trader_1"}, {"trader_2"}),
        (Stats(trades=100), {"trader_1", "trader_2", "trader_3"}, set()),
        (Stats(hearts=3), {"regular"}, {"hearts_1"}),
        (Stats(hearts=99), {"regular", "hearts_1", "hearts_2", "hearts_3"}, set()),
        (Stats(orders=1, categories=3, reviews=2), {"first_order"}, {"collector", "reviewer"}),
        (Stats(orders=4, categories=4, reviews=3, unique=True), {"collector", "reviewer", "unique_hunter"}, set()),
        (Stats(gifts=2), set(), {"santa"}),
        (Stats(gifts=3, wish_done=True, top_buyer=True), {"santa", "wish_done", "top_buyer"}, set()),
    ],
)
def test_badge_thresholds(stats, has, has_not):
    got = codes(stats)
    assert has <= got and not (has_not & got)


def test_representative_is_hardest_badge():
    got = earned(Stats(profile=True, trades=12, hearts=4))
    assert representative(got).code == "trader_1"  # 첫 거래·단골 이웃보다 받기 어렵다


def test_catalog_codes_are_unique():
    assert len({b.code for b in BADGES}) == len(BADGES) == 19
    assert len({b.rank for b in BADGES}) == len(BADGES)  # 대표 뱃지가 한 가지로 정해지게


async def test_badge_book_requires_login(client):
    assert (await client.get("/api/users/me/badges")).status_code == 401


async def test_badge_book_for_new_player(client):
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE email = 'badge-new@pixelmart.test'"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다")
    await client.post("/api/auth/dev-login", json={"email": "badge-new@pixelmart.test", "nickname": "뱃지새내기"})
    try:
        body = (await client.get("/api/users/me/badges")).json()
        assert body["total"] == 19 and body["earnedCount"] == 1
        assert [i["code"] for i in body["items"] if i["earned"]] == ["new_player"]
        assert set(body["items"][0]) == {"code", "icon", "image", "name", "description", "earned"}
    finally:
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE email = 'badge-new@pixelmart.test'"))


def test_every_badge_has_pixel_icon():
    missing = [b.image for b in BADGES if not (PUBLIC / b.image.lstrip("/")).is_file()]
    assert missing == []  # python tools/gen_badges.py


@pytest.mark.parametrize(
    ("now", "start", "end"),
    [
        # 2026-10-13(화) 10시 KST → 10/5(월)~10/12(월) 0시 KST
        ("2026-10-13T01:00:00+00:00", "2026-10-05T00:00:00+09:00", "2026-10-12T00:00:00+09:00"),
        # 월요일 0시 KST 직후에는 바로 지난주로 넘어간다 (UTC로는 일요일 15시)
        ("2026-10-11T15:00:00+00:00", "2026-10-05T00:00:00+09:00", "2026-10-12T00:00:00+09:00"),
        ("2026-10-11T14:59:59+00:00", "2026-09-28T00:00:00+09:00", "2026-10-05T00:00:00+09:00"),
    ],
)
def test_last_week_is_monday_to_monday_kst(now, start, end):
    got = last_week(datetime.fromisoformat(now))
    assert got == (datetime.fromisoformat(start), datetime.fromisoformat(end))


TOP_EMAILS = "('badge-top1@pixelmart.test', 'badge-top2@pixelmart.test', 'badge-top3@pixelmart.test')"


async def test_top_buyer_is_last_weeks_first_place_only(monkeypatch):
    monkeypatch.setattr(local_stats, "EXCLUDED_EMAIL_SUFFIX", "@never.invalid")
    try:
        async with engine.begin() as conn:
            await conn.execute(text(f"DELETE FROM users WHERE email IN {TOP_EMAILS}"))
            ids = []
            for n in (1, 2, 3):
                ids.append(
                    await conn.scalar(
                        text(
                            "INSERT INTO users (email, nickname, region_code) VALUES (:e, :n, '41135-01') RETURNING id"
                        ),
                        {"e": f"badge-top{n}@pixelmart.test", "n": f"뱃지큰손{n}"},
                    )
                )
            # 1번: 지난주 5만 원 · 2번: 지난주 3만 원 + 이번 주 10만 원(이번 주는 다음 주에 반영) · 3번: 지난주 취소
            for user_id, total, at, status in [
                (ids[0], 50000, "2026-10-08T12:00:00+09:00", "paid"),
                (ids[1], 30000, "2026-10-09T12:00:00+09:00", "paid"),
                (ids[1], 100000, "2026-10-12T12:00:00+09:00", "paid"),
                (ids[2], 90000, "2026-10-10T12:00:00+09:00", "cancelled"),
            ]:
                await conn.execute(
                    text(
                        "INSERT INTO orders (user_id, status, total_price, recipient_name, address, created_at) "
                        "VALUES (:u, :s, :t, '테스트', '주소', :c)"
                    ),
                    {"u": user_id, "s": status, "t": total, "c": datetime.fromisoformat(at)},
                )
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다")
    try:
        async with SessionLocal() as db:
            now = datetime(2026, 10, 13, 1, tzinfo=UTC)
            top = await badges._top_buyers(db, {"41135-01"}, now)
            assert ids[0] in top and ids[1] not in top and ids[2] not in top
    finally:
        async with engine.begin() as conn:
            await conn.execute(text(f"DELETE FROM users WHERE email IN {TOP_EMAILS}"))
