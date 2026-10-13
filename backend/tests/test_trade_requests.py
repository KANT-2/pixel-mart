"""PIXEL LOCAL 교환 신청 — 신청·수락·거절·취소 (로컬 DB 필요, 없으면 건너뜀)

다른 테스트와 섞이지 않게 테스트 전용 지역(TRQ › TRQ1 › 생활권)을 만들고 테스트마다 정리한다.
"""

from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app

ZONE = "TRQ1-01"
TEST_REGIONS = [("TRQ", "sido", None, "교환시"), ("TRQ1", "sigungu", "TRQ", "일구"), (ZONE, "zone", "TRQ1", "가동")]


@pytest.fixture
async def users():
    """users(email) → 로그인된 클라이언트. 끝나면 테스트 전용 지역 데이터 정리"""
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
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")

    async with AsyncExitStack() as stack:

        async def make(email: str, nickname_public: bool = False) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email})
            await c.put(
                "/api/users/me/local",
                json={"regionCode": ZONE, "interestIds": [], "fandomOptIn": False, "nicknamePublic": nickname_public},
            )
            return c

        yield make

    async with engine.begin() as conn:
        # 글을 지우면 교환 신청도 CASCADE로 지워진다
        await conn.execute(text("DELETE FROM trade_posts WHERE region_code LIKE 'TRQ%'"))
        await conn.execute(
            text("DELETE FROM activity_points WHERE user_id IN (SELECT id FROM users WHERE region_code LIKE 'TRQ%')")
        )
        await conn.execute(text("UPDATE users SET region_code = NULL WHERE region_code LIKE 'TRQ%'"))
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'TRQ%' AND level = :l"), {"l": level})


async def have(c: AsyncClient, name: str) -> dict:
    res = await c.post("/api/local/trades", json={"kind": "have", "itemName": name, "condition": "used"})
    assert res.status_code == 201, res.text
    return res.json()


async def coins(c: AsyncClient) -> int:
    return (await c.get("/api/users/me/activity")).json()["coins"]


async def test_requires_login(client):
    assert (await client.post("/api/local/trade-requests", json={"postId": 1})).status_code == 401
    assert (await client.get("/api/local/trade-requests")).status_code == 401


async def test_create_shows_in_sent_and_received(users):
    owner = await users("treq-owner@pixelmart.test")
    me = await users("treq-me@pixelmart.test", nickname_public=True)
    target = await have(owner, "슬라임 키링")
    mine = await have(me, "코인 키링")

    res = await me.post("/api/local/trade-requests", json={"postId": target["id"], "offerPostId": mine["id"]})
    assert res.status_code == 201, res.text
    created = res.json()
    assert set(created) == {"id", "status", "createdAt", "decidedAt", "post", "offerPost", "isMine", "requester"}
    assert (created["status"], created["isMine"], created["decidedAt"]) == ("pending", True, None)
    assert (created["post"]["id"], created["post"]["isMine"]) == (target["id"], False)
    assert (created["offerPost"]["id"], created["offerPost"]["isMine"]) == (mine["id"], True)

    sent = (await me.get("/api/local/trade-requests", params={"box": "sent"})).json()
    assert [r["id"] for r in sent] == [created["id"]]
    assert (await me.get("/api/local/trade-requests")).json() == []

    received = (await owner.get("/api/local/trade-requests")).json()
    assert [(r["id"], r["isMine"], r["post"]["isMine"]) for r in received] == [(created["id"], False, True)]
    assert received[0]["requester"]["nickname"]  # 닉네임 공개 동의자
    assert (await owner.get("/api/local/trade-requests", params={"box": "sent"})).json() == []


async def test_requester_hidden_without_nickname_opt_in(users):
    owner = await users("treq-owner@pixelmart.test")
    me = await users("treq-me@pixelmart.test")
    target = await have(owner, "슬라임 키링")
    await me.post("/api/local/trade-requests", json={"postId": target["id"]})
    received = (await owner.get("/api/local/trade-requests")).json()
    assert received[0]["requester"] is None and received[0]["offerPost"] is None


async def test_create_rules(users):
    owner = await users("treq-owner@pixelmart.test")
    me = await users("treq-me@pixelmart.test")
    target = await have(owner, "슬라임 키링")
    others = await have(owner, "던전 키링")
    hidden = await have(owner, "숨긴 키링")
    await owner.patch(f"/api/local/trades/{hidden['id']}", json={"status": "hidden"})
    closed = await have(owner, "끝난 키링")
    await owner.patch(f"/api/local/trades/{closed['id']}", json={"status": "done"})
    sample = await have(owner, "샘플 키링")
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE trade_posts SET is_sample = true WHERE id = :i"), {"i": sample["id"]})

    async def create(body: dict, client: AsyncClient = me):
        res = await client.post("/api/local/trade-requests", json=body)
        return res.status_code, res.json().get("detail")

    assert await create({"postId": 999999}) == (404, "거래글을 찾을 수 없습니다.")
    assert await create({"postId": hidden["id"]}) == (404, "거래글을 찾을 수 없습니다.")
    assert await create({"postId": target["id"]}, owner) == (400, "내 글에는 교환을 신청할 수 없어요.")
    assert await create({"postId": sample["id"]}) == (400, "샘플 글에는 교환을 신청할 수 없어요.")
    assert await create({"postId": closed["id"]}) == (400, "이미 마감된 글이에요.")
    bad_offer = (400, "내 진행 중인 글만 함께 보낼 수 있어요.")
    assert await create({"postId": target["id"], "offerPostId": others["id"]}) == bad_offer  # 남의 글

    assert (await create({"postId": target["id"]}))[0] == 201
    assert await create({"postId": target["id"]}) == (400, "이미 교환을 신청했어요.")


async def test_accept_closes_posts_declines_others_and_awards(users):
    owner = await users("treq-owner@pixelmart.test")
    me = await users("treq-me@pixelmart.test")
    rival = await users("treq-rival@pixelmart.test")
    target = await have(owner, "슬라임 키링")
    mine = await have(me, "코인 키링")
    req = (await me.post("/api/local/trade-requests", json={"postId": target["id"], "offerPostId": mine["id"]})).json()
    other = (await rival.post("/api/local/trade-requests", json={"postId": target["id"]})).json()
    before = (await coins(owner), await coins(me))

    # 신청한 사람·제3자는 수락할 수 없다 (남의 신청은 404)
    assert (await me.post(f"/api/local/trade-requests/{req['id']}/accept")).status_code == 404
    assert (await rival.post(f"/api/local/trade-requests/{req['id']}/accept")).status_code == 404

    res = await owner.post(f"/api/local/trade-requests/{req['id']}/accept")
    assert res.status_code == 200, res.text
    accepted = res.json()
    assert accepted["status"] == "accepted" and accepted["decidedAt"]
    assert accepted["post"]["status"] == "done" and accepted["offerPost"]["status"] == "done"

    rival_sent = (await rival.get("/api/local/trade-requests", params={"box": "sent"})).json()
    assert [(r["id"], r["status"]) for r in rival_sent] == [(other["id"], "declined")]
    assert (await coins(owner), await coins(me)) == (before[0] + 1, before[1] + 1)

    again = await owner.post(f"/api/local/trade-requests/{req['id']}/accept")
    assert (again.status_code, again.json()["detail"]) == (400, "이미 처리된 신청이에요.")


async def test_decline_by_owner(users):
    owner = await users("treq-owner@pixelmart.test")
    me = await users("treq-me@pixelmart.test")
    target = await have(owner, "슬라임 키링")
    req = (await me.post("/api/local/trade-requests", json={"postId": target["id"]})).json()

    assert (await me.post(f"/api/local/trade-requests/{req['id']}/decline")).status_code == 404
    res = (await owner.post(f"/api/local/trade-requests/{req['id']}/decline")).json()
    assert res["status"] == "declined" and res["post"]["status"] == "open"
    # 거절된 뒤에는 다시 신청할 수 있다
    assert (await me.post("/api/local/trade-requests", json={"postId": target["id"]})).status_code == 201


async def test_cancel_by_requester_only(users):
    owner = await users("treq-owner@pixelmart.test")
    me = await users("treq-me@pixelmart.test")
    stranger = await users("treq-stranger@pixelmart.test")
    target = await have(owner, "슬라임 키링")
    req = (await me.post("/api/local/trade-requests", json={"postId": target["id"]})).json()

    assert (await owner.post(f"/api/local/trade-requests/{req['id']}/cancel")).status_code == 404
    assert (await stranger.post(f"/api/local/trade-requests/{req['id']}/cancel")).status_code == 404
    res = (await me.post(f"/api/local/trade-requests/{req['id']}/cancel")).json()
    assert res["status"] == "cancelled"
    assert (await me.post(f"/api/local/trade-requests/{req['id']}/cancel")).status_code == 400
    assert (await owner.post(f"/api/local/trade-requests/{req['id']}/accept")).status_code == 400
