"""하트(지역 커뮤니티 참여도)·코인·이웃 카드 — 규칙은 DB 없이, 적립·카드는 로컬 DB 필요(없으면 건너뜀)

테스트 전용 지역(ACT › ACT1 › 생활권)을 만들고 끝나면 정리한다.
"""

import json
from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from app.services import activity, local_stats

ZONE = "ACT1-01"
TEST_REGIONS = [("ACT", "sido", None, "활동시"), ("ACT1", "sigungu", "ACT", "일구"), (ZONE, "zone", "ACT1", "가동")]
WORK = 1  # 나루토 (작품)
USERS = "SELECT id FROM users WHERE email LIKE 'act-%@pixelmart.test'"


# --- 규칙 (DB 없이) ---


@pytest.mark.parametrize(
    ("score", "hearts", "next_at"),
    # 하트 3개(90점)부터는 30점마다 하나씩, 최대 99개
    [
        (0, 0, 30),
        (29, 0, 30),
        (30, 1, 65),
        (65, 2, 90),
        (89, 2, 90),
        (90, 3, 120),
        (119, 3, 120),
        (120, 4, 150),
        (240, 8, 270),
        (3000, 99, None),
        (99999, 99, None),
    ],
)
def test_hearts_from_score(score, hearts, next_at):
    assert activity.hearts_for(score) == hearts
    assert activity.next_heart_at(score) == next_at


def test_levels_and_coin_bands():
    assert [activity.level_title(h) for h in (0, 1, 2, 3, 12, 99)] == [
        "새내기 이웃",
        "동네 이웃",
        "친한 이웃",
        "단골 이웃",
        "단골 이웃",
        "단골 이웃",
    ]
    assert [activity.coin_band(n) for n in (0, 1, 4, 5, 9, 10, 29, 30, 49, 50, 99, 100, 500)] == [
        None,
        "교환 1회+",
        "교환 1회+",
        "교환 5회+",
        "교환 5회+",
        "교환 10회+",
        "교환 10회+",
        "교환 30회+",
        "교환 30회+",
        "교환 50회+",
        "교환 50회+",
        "교환 100회+",
        "교환 100회+",
    ]


# --- 적립·카드 (로컬 DB) ---


@pytest.fixture
async def users(monkeypatch):
    monkeypatch.setattr(local_stats, "EXCLUDED_EMAIL_SUFFIX", "@never.invalid")
    try:
        async with engine.begin() as conn:
            for code, level, parent, name in TEST_REGIONS:
                await conn.execute(
                    text(
                        "INSERT INTO regions (code, level, parent_code, name) VALUES (:c, :l, :p, :n) "
                        "ON CONFLICT (code) DO NOTHING"
                    ),
                    {"c": code, "l": level, "p": parent, "n": name},
                )
            await conn.execute(text(f"DELETE FROM activity_points WHERE user_id IN ({USERS})"))
            await conn.execute(text(f"DELETE FROM trade_posts WHERE user_id IN ({USERS})"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")

    async with AsyncExitStack() as stack:

        async def make(email: str, card=False, nickname_public=False, profile_public=False, interests=(WORK,)):
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email, "nickname": email.split("@")[0]})
            body = {
                "regionCode": ZONE,
                "interestIds": list(interests),
                "mapAvatarOptIn": True,
                "mapCardPublic": card,
                "nicknamePublic": nickname_public,
                "profilePublic": profile_public,
            }
            assert (await c.put("/api/users/me/local", json=body)).status_code == 200
            return c

        yield make

    async with engine.begin() as conn:
        await conn.execute(text(f"DELETE FROM activity_points WHERE user_id IN ({USERS})"))
        await conn.execute(text(f"DELETE FROM trade_posts WHERE user_id IN ({USERS})"))
        await conn.execute(text("DELETE FROM fandom_samples WHERE region_code LIKE 'ACT%'"))
        await conn.execute(
            text("UPDATE users SET region_code = NULL, map_avatar_opt_in = false WHERE region_code LIKE 'ACT%'")
        )
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'ACT%' AND level = :l"), {"l": level})


def want(name: str) -> dict:
    return {"kind": "want", "itemName": name, "tradeMethod": "delivery", "content": "구해요"}


def have(name: str) -> dict:
    return want(name) | {"kind": "have", "condition": "used"}


async def score(c: AsyncClient) -> dict:
    return (await c.get("/api/users/me/activity")).json()


async def test_activity_requires_login(client):
    assert (await client.get("/api/users/me/activity")).status_code == 401


async def test_profile_and_first_want_count_once(users):
    me = await users("act-once@pixelmart.test")
    await me.put("/api/users/me/local", json={"regionCode": ZONE, "interestIds": [WORK, 2], "mapAvatarOptIn": True})
    assert (await score(me))["score"] == 5  # 프로필 완성은 한 번만

    await me.post("/api/local/trades", json=want("키링 하나"))
    await me.post("/api/local/trades", json=want("머그컵 하나"))
    mine = await score(me)
    assert mine["score"] == 15 and mine["hearts"] == 0 and mine["level"] == "새내기 이웃" and mine["nextHeartAt"] == 30
    assert [r["label"] for r in mine["recent"]] == ["첫 WANT 등록", "지역·취향 프로필 처음 완성"]


async def test_no_profile_points_without_interests(users):
    me = await users("act-empty@pixelmart.test", interests=())
    assert (await score(me))["score"] == 0


async def test_trade_done_once_per_post_and_daily_cap(users):
    me = await users("act-trader@pixelmart.test")
    ids = [(await me.post("/api/local/trades", json=have(f"아크릴 {n}"))).json()["id"] for n in range(4)]
    await me.patch(f"/api/local/trades/{ids[0]}", json={"status": "done"})
    await me.patch(f"/api/local/trades/{ids[0]}", json={"status": "done"})  # 같은 글은 한 번만
    assert (await score(me))["coins"] == 1
    for post_id in ids[1:]:
        await me.patch(f"/api/local/trades/{post_id}", json={"status": "done"})
    mine = await score(me)
    assert mine["coins"] == 3  # 하루 최대 3건
    assert mine["score"] == 5 + 20 * 3 and mine["hearts"] == 2 and mine["coinBand"] == "교환 1회+"


async def test_cards_only_for_opted_in_and_without_identity(users):
    shown = await users("act-card@pixelmart.test", card=True, nickname_public=True, profile_public=True)
    await shown.post("/api/local/trades", json=want("픽셀 키링"))
    await users("act-hidden-nick@pixelmart.test", card=True)
    for n in range(3):
        await users(f"act-nocard{n}@pixelmart.test")
    viewer = shown

    res = await viewer.get("/api/local/map-avatars", params={"region": "ACT1"})
    zone = next(r for r in res.json() if r["regionCode"] == ZONE)
    cards = [c for c in zone["cards"] if c]
    assert len(zone["cards"]) == 5 and len(cards) == 2  # 카드 공개 동의자 2명만

    mine = next(c for c in cards if c["isMe"])
    assert mine == {
        "nickname": "act-card",
        "hearts": 0,
        "level": "새내기 이웃",
        "coinBand": None,
        "interests": ["나루토"],
        "wantCount": 1,
        "isMe": True,
        "isPublic": True,
        "isSample": False,
    }
    other = next(c for c in cards if not c["isMe"])
    assert other["nickname"] is None and other["interests"] == [] and other["wantCount"] == 0  # 닉네임·취향 비공개
    raw = json.dumps(res.json())
    assert "pixelmart.test" not in raw and '"score"' not in raw and '"userId"' not in raw  # 이메일·점수·id 없음


async def test_sample_blocks_have_sample_cards(client):
    try:
        rows = (await client.get("/api/local/map-avatars")).json()
    except Exception:
        pytest.skip("로컬 DB가 없습니다")
    sample = next((r for r in rows if r["isSample"]), None)
    if sample is None:
        pytest.skip("덕력지도 샘플이 없거나 실제 동의자가 충분합니다")
    assert len(sample["cards"]) == len(sample["avatars"])
    fake = [c for c in sample["cards"] if c and c["isSample"]]
    assert fake and all(not c["isMe"] for c in fake)  # 실제 이웃이 섞여 있어도 샘플 캐릭터는 카드가 있다


async def test_my_card_is_shown_to_me_even_when_not_public(users):
    me = await users("act-private@pixelmart.test")  # 카드 공개 안 함
    other = await users("act-other@pixelmart.test")
    mine = [c for c in (await me.get("/api/local/map-avatars", params={"region": "ACT1"})).json()[0]["cards"] if c]
    assert [(c["isMe"], c["isPublic"]) for c in mine] == [(True, False)]  # 나에게만 내 카드
    theirs = (await other.get("/api/local/map-avatars", params={"region": "ACT1"})).json()[0]["cards"]
    assert [c["isMe"] for c in theirs if c] == [True]  # 다른 이웃에게는 내 카드가 안 보이고, 그 이웃 자기 카드만


async def test_few_real_neighbors_are_mixed_with_sample_characters(users):
    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO fandom_samples (region_code, interest_id, count) VALUES (:r, :i, 8)"),
            {"r": ZONE, "i": WORK},
        )
    viewer = await users("act-mix@pixelmart.test", card=True)
    zone = (await viewer.get("/api/local/map-avatars", params={"region": "ACT1"})).json()[0]
    assert zone["count"] == 8 and len(zone["avatars"]) == 8 and zone["isSample"] is True
    assert zone["cards"][0]["isMe"] is True and zone["cards"][0]["isSample"] is False  # 실제 이웃이 맨 앞
    assert all(c["isSample"] for c in zone["cards"][1:])  # 남는 자리는 샘플 캐릭터
