"""앱 안 알림 — 목록·안 읽은 개수·읽음 처리, 교환·선물·주문·활동 점수 알림 (로컬 DB 필요, 없으면 건너뜀)

테스트 전용 지역(NTF › NTF1 › 생활권)과 `ntf-*@pixelmart.test` 계정을 쓰고 끝나면 정리한다.
"""

from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import SessionLocal, engine
from app.main import app
from app.services import notifications

ZONE = "NTF1-01"
TEST_REGIONS = [("NTF", "sido", None, "알림시"), ("NTF1", "sigungu", "NTF", "일구"), (ZONE, "zone", "NTF1", "가동")]
USERS = "SELECT id FROM users WHERE email LIKE 'ntf-%@pixelmart.test'"
PRODUCT = 3
ADDRESS = {"recipientName": "받는이", "address": "서울시 픽셀구 알림로 1"}


async def cleanup() -> None:
    async with engine.begin() as conn:
        await conn.execute(text(f"DELETE FROM gifts WHERE sender_id IN ({USERS}) OR recipient_id IN ({USERS})"))
        await conn.execute(text(f"DELETE FROM orders WHERE user_id IN ({USERS})"))
        await conn.execute(text(f"DELETE FROM cart_items WHERE user_id IN ({USERS})"))
        await conn.execute(text(f"DELETE FROM activity_points WHERE user_id IN ({USERS})"))
        await conn.execute(text(f"DELETE FROM notifications WHERE user_id IN ({USERS})"))
        await conn.execute(text("DELETE FROM trade_posts WHERE region_code LIKE 'NTF%'"))
        await conn.execute(text("UPDATE users SET region_code = NULL WHERE region_code LIKE 'NTF%'"))


@pytest.fixture
async def users():
    """users(email) → 로그인된 클라이언트 (지역만 설정, 취향 없음 → 점수 없음)"""
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
        await cleanup()
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")

    async with AsyncExitStack() as stack:

        async def make(email: str) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email})
            await c.put("/api/users/me/local", json={"regionCode": ZONE, "interestIds": []})
            return c

        yield make

    await cleanup()
    for level in ("zone", "sigungu", "sido"):
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'NTF%' AND level = :l"), {"l": level})


async def user_id(email: str) -> int:
    async with engine.connect() as conn:
        return (await conn.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email})).scalar_one()


async def add(uid: int, kind: str, title: str = "알림", ref_key: str = "") -> None:
    async with SessionLocal() as db:
        await notifications.notify(db, uid, kind, title, "본문", "/mypage", ref_key)
        await db.commit()


async def inbox(c: AsyncClient) -> list[dict]:
    res = await c.get("/api/notifications")
    assert res.status_code == 200, res.text
    return res.json()["items"]


def kinds(items: list[dict]) -> list[str]:
    return [n["kind"] for n in items]


async def test_requires_login(client):
    assert (await client.get("/api/notifications")).status_code == 401
    assert (await client.get("/api/notifications/unread-count")).status_code == 401
    assert (await client.post("/api/notifications/read", json={"ids": None})).status_code == 401


async def test_list_unread_and_read(users):
    me = await users("ntf-me@pixelmart.test")
    other = await users("ntf-other@pixelmart.test")
    uid, other_id = await user_id("ntf-me@pixelmart.test"), await user_id("ntf-other@pixelmart.test")
    for i in range(3):
        await add(uid, "test", f"알림 {i}", f"t:{i}")
    await add(other_id, "test", "남의 알림", "t:x")

    res = (await me.get("/api/notifications")).json()
    assert res["unread"] == 3
    assert [n["title"] for n in res["items"]] == ["알림 2", "알림 1", "알림 0"]  # 최신순
    assert set(res["items"][0]) == {"id", "kind", "title", "body", "href", "createdAt", "read"}
    assert res["items"][0]["read"] is False and res["items"][0]["href"] == "/mypage"
    assert len((await me.get("/api/notifications", params={"limit": 2})).json()["items"]) == 2
    assert (await me.get("/api/notifications", params={"limit": 51})).status_code == 422
    assert (await me.get("/api/notifications/unread-count")).json() == {"unread": 3}

    # 남의 알림 id는 무시하고 내 것만 읽음
    others = await inbox(other)
    first = res["items"][0]["id"]
    res = await me.post("/api/notifications/read", json={"ids": [first, others[0]["id"]]})
    assert res.json() == {"unread": 2}
    assert [n["read"] for n in await inbox(me)] == [True, False, False]
    assert (await other.get("/api/notifications/unread-count")).json() == {"unread": 1}

    assert (await me.post("/api/notifications/read", json={})).json() == {"unread": 0}
    assert all(n["read"] for n in await inbox(me))
    assert [n["title"] for n in await inbox(other)] == ["남의 알림"]


async def test_duplicate_ref_key_is_ignored(users):
    await users("ntf-me@pixelmart.test")
    uid = await user_id("ntf-me@pixelmart.test")
    await add(uid, "test", "처음", "same")
    await add(uid, "test", "두 번째", "same")
    await add(uid, "other", "종류가 다르면 따로", "same")
    async with engine.connect() as conn:
        rows = (await conn.execute(text("SELECT title FROM notifications WHERE user_id = :u"), {"u": uid})).all()
    assert sorted(r[0] for r in rows) == ["종류가 다르면 따로", "처음"]


async def test_trade_request_and_accept(users):
    owner = await users("ntf-owner@pixelmart.test")
    me = await users("ntf-me@pixelmart.test")
    rival = await users("ntf-rival@pixelmart.test")
    post = (
        await owner.post("/api/local/trades", json={"kind": "have", "itemName": "슬라임 키링", "condition": "used"})
    ).json()
    mine = (await me.post("/api/local/trade-requests", json={"postId": post["id"]})).json()
    await rival.post("/api/local/trade-requests", json={"postId": post["id"]})

    got = await inbox(owner)
    assert kinds(got) == ["trade_request", "trade_request"]
    assert got[0]["title"] == "새 교환 신청이 왔어요"
    assert got[0]["body"] == "슬라임 키링에 교환 신청이 도착했어요."
    assert got[0]["href"] == "/local/trades/mine#trade-requests"
    assert await inbox(me) == []

    assert (await owner.post(f"/api/local/trade-requests/{mine['id']}/accept")).status_code == 200
    mine_box = await inbox(me)
    assert "trade_accepted" in kinds(mine_box) and "points" in kinds(mine_box)
    accepted = next(n for n in mine_box if n["kind"] == "trade_accepted")
    assert accepted["href"] == "/local/trades/mine#trade-requests"
    # 같은 글의 다른 신청은 자동 거절 알림
    assert "trade_declined" in kinds(await inbox(rival))
    # 거래 완료 점수·첫 거래 뱃지는 두 사람 모두
    for c in (owner, me):
        box = await inbox(c)
        points = next(n for n in box if n["kind"] == "points")
        assert (points["title"], points["body"], points["href"]) == (
            "활동 점수 +20",
            "거래·교환 정상 완료",
            "/mypage/quests",
        )
        assert "뱃지 획득! 첫 거래" in [n["title"] for n in box]


async def test_decline_notifies_requester(users):
    owner = await users("ntf-owner@pixelmart.test")
    me = await users("ntf-me@pixelmart.test")
    post = (
        await owner.post("/api/local/trades", json={"kind": "have", "itemName": "던전 키링", "condition": "used"})
    ).json()
    req = (await me.post("/api/local/trade-requests", json={"postId": post["id"]})).json()
    await owner.post(f"/api/local/trade-requests/{req['id']}/decline")
    assert kinds(await inbox(me)) == ["trade_declined"]


async def test_gift_send_and_accept(users):
    sender = await users("ntf-sender@pixelmart.test")
    friend = await users("ntf-friend@pixelmart.test")
    want = await friend.post("/api/local/trades", json={"kind": "want", "itemName": "보물상자", "productId": PRODUCT})
    assert want.status_code == 201, want.text
    await friend.post("/api/notifications/read", json={})  # 첫 WANT 점수·뱃지 알림은 제외
    gift = await sender.post("/api/gifts", json={"tradePostId": want.json()["id"], "productId": PRODUCT})
    assert gift.status_code == 201, gift.text

    received = [n for n in await inbox(friend) if not n["read"]]
    assert kinds(received) == ["gift_received"] and received[0]["href"] == "/mypage/gifts"
    assert kinds(await inbox(sender)) == ["gift_sent"]

    res = await friend.post(f"/api/gifts/{gift.json()['id']}/accept", json=ADDRESS)
    assert res.status_code == 200, res.text
    sent_box = kinds(await inbox(sender))
    assert {"gift_accepted", "points"} <= set(sent_box)
    friend_box = await inbox(friend)
    # 선물로 생긴 주문은 주문 알림 대신 선물 알림, 받은 사람은 첫 장착·소원 성취 뱃지
    assert "order_placed" not in kinds(friend_box)
    assert {"뱃지 획득! 첫 장착", "뱃지 획득! 소원 성취"} <= {n["title"] for n in friend_box}


async def test_gift_decline_notifies_sender(users):
    sender = await users("ntf-sender@pixelmart.test")
    friend = await users("ntf-friend@pixelmart.test")
    want = await friend.post("/api/local/trades", json={"kind": "want", "itemName": "보물상자", "productId": PRODUCT})
    gift = await sender.post("/api/gifts", json={"tradePostId": want.json()["id"], "productId": PRODUCT})
    await friend.post(f"/api/gifts/{gift.json()['id']}/decline")
    assert kinds(await inbox(sender)) == ["gift_declined", "gift_sent"]


async def test_order_notifies_buyer(users):
    me = await users("ntf-me@pixelmart.test")
    await me.post("/api/cart/items", json={"productId": PRODUCT, "quantity": 2})
    order = await me.post("/api/orders", json=ADDRESS)
    assert order.status_code == 201, order.text
    order_id = order.json()["id"]
    box = await inbox(me)
    placed = next(n for n in box if n["kind"] == "order_placed")
    assert (placed["title"], placed["body"], placed["href"]) == (
        "주문이 완료됐어요",
        f"주문번호 {order_id} · 상품 2개",
        f"/mypage/orders/{order_id}",
    )
    assert "뱃지 획득! 첫 장착" in [n["title"] for n in box]


async def test_award_points_and_heart_up(users):
    me = await users("ntf-me@pixelmart.test")
    uid = await user_id("ntf-me@pixelmart.test")
    # 28점 → 프로필 완성 +5 = 33점으로 하트 1개
    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO activity_points (user_id, kind, ref_id, points) VALUES (:u, 'contribution', 1, 28)"),
            {"u": uid},
        )
    await me.put("/api/users/me/local", json={"regionCode": ZONE, "interestIds": [1]})
    box = await inbox(me)
    by_kind = {n["kind"]: n for n in box}
    assert (by_kind["points"]["title"], by_kind["points"]["body"]) == ("활동 점수 +5", "지역·취향 프로필 처음 완성")
    assert (by_kind["heart_up"]["title"], by_kind["heart_up"]["body"]) == ("하트가 늘었어요 ♥×1", "LV.2 동네 이웃")
    assert "뱃지 획득! 동네 등록" in [n["title"] for n in box]

    # 두 번째 저장은 점수가 없으니 알림도 없다
    await me.put("/api/users/me/local", json={"regionCode": ZONE, "interestIds": [1]})
    assert len(await inbox(me)) == len(box)


async def test_badge_notifies_only_once(users):
    await users("ntf-me@pixelmart.test")
    uid = await user_id("ntf-me@pixelmart.test")
    async with SessionLocal() as db:
        before = await notifications.snapshot(db, uid)
        await db.execute(
            text("INSERT INTO activity_points (user_id, kind, ref_id, points) VALUES (:u, 'trade_done', 1, 20)"),
            {"u": uid},
        )
        # 같은 '이전 기록'으로 두 번 비교해도 뱃지 알림은 한 번만
        await notifications.notify_progress(db, uid, before)
        await notifications.notify_progress(db, uid, before)
        await db.commit()
    async with engine.connect() as conn:
        rows = (
            await conn.execute(
                text("SELECT ref_key FROM notifications WHERE user_id = :u AND kind = 'badge'"), {"u": uid}
            )
        ).all()
    assert [r[0] for r in rows] == ["badge:first_trade"]


@pytest.mark.usefixtures("require_db")
async def test_sample_author_gets_nothing():
    try:
        async with SessionLocal() as db:
            sample = await db.scalar(text("SELECT id FROM users WHERE email = :e"), {"e": notifications.SAMPLE_EMAIL})
            if sample is None:
                pytest.skip("샘플 작성자가 없습니다 (python -m scripts.seed_local)")
            await notifications.notify(db, sample, "test", "샘플", "본문", ref_key="ntf-sample")
            found = await db.scalar(text("SELECT count(*) FROM notifications WHERE user_id = :u"), {"u": sample})
            await db.rollback()
    except OSError:
        pytest.skip("로컬 DB가 없습니다")
    assert found == 0
