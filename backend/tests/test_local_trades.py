"""PIXEL LOCAL ③ 거래·HAVE/WANT 교환 · 매칭 · Wish Map (로컬 DB 필요, 없으면 건너뜀)

다른 테스트·샘플 데이터와 섞이지 않게 테스트 전용 지역(TRD › TRD1·TRD2 › 생활권)을 만들고 테스트마다 정리한다.
"""

from contextlib import AsyncExitStack
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from app.services import local_stats
from app.services.trade_rules import contains_private_info, same_item

ZONE_A, ZONE_B, OTHER_DISTRICT = "TRD1-01", "TRD1-02", "TRD2-01"
TEST_REGIONS = [
    ("TRD", "sido", None, "거래시"),
    ("TRD1", "sigungu", "TRD", "일구"),
    ("TRD2", "sigungu", "TRD", "이구"),
    ("TRD1-01", "zone", "TRD1", "가동"),
    ("TRD1-02", "zone", "TRD1", "나동"),
    ("TRD2-01", "zone", "TRD2", "다동"),
]
OROCHIMARU, KAKASHI = 12, 13


# --- 규칙 (DB 없이) ---


@pytest.mark.parametrize(
    "value",
    [
        "010-1234-5678",
        "01012345678",
        "me@example.com",
        "open.kakao.com/o/abc",
        "카톡 아이디 pixel",
        "101동 1203호",
        "12번지",
    ],
)
def test_private_info_detected(value):
    assert contains_private_info("물건", value)


def test_plain_text_allowed():
    assert not contains_private_info("카카시 키링", "판교역 근처 직거래 원해요. 상태 좋아요 (2024년 구매)")


def item(product_id=None, interest_id=None, name="x"):
    return SimpleNamespace(product_id=product_id, interest_id=interest_id, item_name=name)


def test_same_item():
    assert same_item(item(product_id=1, name="a"), item(product_id=1, name="b"))
    assert same_item(item(interest_id=OROCHIMARU, name="키링"), item(interest_id=OROCHIMARU, name="피규어"))
    assert same_item(item(name="오로치마루 키링"), item(name=" 오로치마루키링 "))
    assert not same_item(item(product_id=1, name="a"), item(product_id=2, name="b"))


# --- API ---


@pytest.fixture
async def users():
    """users(email, region) → 로그인된 클라이언트. 끝나면 테스트 전용 지역 데이터 정리"""
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

        async def make(email: str, region: str | None = ZONE_A, opt_in: bool = True) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email})
            await c.put("/api/users/me/local", json={"regionCode": region, "interestIds": [], "fandomOptIn": opt_in})
            return c

        yield make

    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM trade_posts WHERE region_code LIKE 'TRD%'"))
        await conn.execute(text("UPDATE users SET region_code = NULL WHERE region_code LIKE 'TRD%'"))
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'TRD%' AND level = :l"), {"l": level})


def post(kind: str, name: str, **extra) -> dict:
    body = {"kind": kind, "itemName": name, "condition": "used" if kind != "want" else None}
    return body | extra


async def test_create_requires_login(client):
    assert (await client.post("/api/local/trades", json=post("have", "키링"))).status_code == 401


async def test_create_needs_region(users):
    c = await users("trade-noregion@pixelmart.test", region=None)
    assert (await c.post("/api/local/trades", json=post("have", "키링"))).status_code == 400


@pytest.mark.parametrize(
    ("body", "status_code"),
    [
        (post("have", "키링", condition=None), 422),
        (post("sell", "키링", content="010-1234-5678로 연락 주세요"), 422),
        (post("have", "키링", content="101동 1203호 앞에서 만나요"), 422),
        (post("sell", "키링", price=-1), 422),
        (post("have", "키링", productId=999), 404),
        (post("have", "키링", interestId=99999), 404),
    ],
    ids=["have-needs-condition", "contact", "exact-place", "negative-price", "unknown-product", "unknown-interest"],
)
async def test_create_validation(users, body, status_code):
    c = await users("trade-a@pixelmart.test")
    assert (await c.post("/api/local/trades", json=body)).status_code == status_code


async def test_create_and_list_with_policy_fields_only(users):
    a = await users("trade-a@pixelmart.test")
    res = await a.post(
        "/api/local/trades",
        json=post("sell", "  HP 하트 키캡 ", productId=1, condition="new", price=8000, tradeMethod="both"),
    )
    assert res.status_code == 201
    created = res.json()
    assert created["regionCode"] == ZONE_A  # 지역은 내 프로필에서
    assert created["regionName"] == "거래시 일구 가동"
    assert (created["itemName"], created["price"], created["tradeMethod"]) == ("HP 하트 키캡", 8000, "both")
    assert created["product"]["imageUrl"].endswith(".webp")
    assert (created["isMine"], created["isSample"]) == (True, False)

    viewer = await users("trade-viewer@pixelmart.test", region=OTHER_DISTRICT)
    # 상위 지역(구·시)으로 조회해도 하위 생활권 글이 나온다
    for region in (ZONE_A, "TRD1", "TRD"):
        listed = (await viewer.get("/api/local/trades", params={"region": region, "kind": "sell"})).json()
        assert [p["id"] for p in listed["items"]] == [created["id"]]
    item_out = listed["items"][0]
    assert item_out["isMine"] is False
    assert not {"userId", "authorNickname", "email", "nickname"} & set(item_out)


async def test_duplicate_open_post_is_400_until_done(users):
    a = await users("trade-a@pixelmart.test")
    first = (await a.post("/api/local/trades", json=post("want", "오로치마루 키링"))).json()
    assert (await a.post("/api/local/trades", json=post("want", "오로치마루키링"))).status_code == 400

    done = await a.patch(f"/api/local/trades/{first['id']}", json={"status": "done"})
    assert done.json()["status"] == "done"
    assert (await a.post("/api/local/trades", json=post("want", "오로치마루 키링"))).status_code == 201


async def test_done_and_hidden_posts_only_in_mine(users):
    a = await users("trade-a@pixelmart.test")
    hidden = (await a.post("/api/local/trades", json=post("have", "고스트 키링"))).json()
    await a.patch(f"/api/local/trades/{hidden['id']}", json={"status": "hidden"})

    assert (await a.get("/api/local/trades", params={"region": "TRD"})).json()["total"] == 0
    mine = (await a.get("/api/local/trades/mine")).json()
    assert [(p["id"], p["status"]) for p in mine] == [(hidden["id"], "hidden")]


async def test_cannot_change_others_post(users):
    a = await users("trade-a@pixelmart.test")
    b = await users("trade-b@pixelmart.test")
    created = (await a.post("/api/local/trades", json=post("have", "미믹 키링"))).json()
    assert (await b.patch(f"/api/local/trades/{created['id']}", json={"status": "hidden"})).status_code == 404
    assert (await a.patch(f"/api/local/trades/{created['id']}", json={"status": "open"})).status_code == 422


async def test_matches_same_district_mutual_and_zone_first(users):
    me = await users("trade-me@pixelmart.test", region=ZONE_A)
    swapper = await users("trade-swap@pixelmart.test", region=ZONE_B)
    seller = await users("trade-seller@pixelmart.test", region=ZONE_A)
    far = await users("trade-far@pixelmart.test", region=OTHER_DISTRICT)

    await me.post("/api/local/trades", json=post("want", "오로치마루 키링", interestId=OROCHIMARU))
    await me.post("/api/local/trades", json=post("have", "카카시 키링", interestId=KAKASHI))
    swap = (
        await swapper.post("/api/local/trades", json=post("have", "오로치마루 아크릴", interestId=OROCHIMARU))
    ).json()
    await swapper.post("/api/local/trades", json=post("want", "카카시 굿즈", interestId=KAKASHI))  # 맞교환 후보
    sell = (await seller.post("/api/local/trades", json=post("sell", "오로치마루 키링", price=5000))).json()
    await far.post("/api/local/trades", json=post("have", "오로치마루 키링", interestId=OROCHIMARU))  # 다른 구

    matches = (await me.get("/api/local/trades/matches")).json()
    assert [(m["offer"]["id"], m["proximity"], m["mutual"]) for m in matches] == [
        (swap["id"], "same_district", True),
        (sell["id"], "same_zone", False),
    ]
    assert (await far.get("/api/local/trades/matches")).json() == []


async def test_wish_map_ranks_opted_in_neighbors(users, monkeypatch):
    monkeypatch.setattr(local_stats, "EXCLUDED_EMAIL_SUFFIX", "@never.invalid")
    zone_a = [await users(f"wishmap-a{n}@pixelmart.test", region=ZONE_A) for n in range(1, 6)]
    zone_b = await users("wishmap-b1@pixelmart.test", region=ZONE_B)
    off = await users("wishmap-off@pixelmart.test", region=ZONE_A, opt_in=False)
    for i, c in enumerate(zone_a):
        await c.put("/api/wishlist/130")
        if i < 4:
            await c.put("/api/wishlist/131")
    await zone_b.put("/api/wishlist/131")
    await off.put("/api/wishlist/131")  # 집계 미참여

    zone = (await zone_a[0].get("/api/local/wish-map", params={"region": ZONE_A})).json()
    assert [(r["rank"], r["product"]["id"], r["count"]) for r in zone] == [(1, 130, 5)]  # 131은 4명
    district = (await zone_a[0].get("/api/local/wish-map", params={"region": "TRD1"})).json()
    assert [(r["product"]["id"], r["count"]) for r in district] == [(130, 5), (131, 5)]


async def test_wish_map_excludes_test_accounts_and_validates(users):
    c = await users("wishmap-a1@pixelmart.test", region=ZONE_A)
    assert (await c.get("/api/local/wish-map", params={"region": ZONE_A})).json() == []
    assert (await c.get("/api/local/wish-map", params={"region": "NOPE"})).status_code == 404
    assert (await c.get("/api/local/wish-map")).status_code == 422


async def test_sample_posts_are_marked(client):
    listed = (await client.get("/api/local/trades", params={"region": "41135", "size": 60})).json()
    samples = [p for p in listed["items"] if p["isSample"]]
    if not samples:
        pytest.skip("샘플 거래글 시드 전입니다 (python -m scripts.seed)")
    assert all(p["regionName"].startswith("성남시 분당구") for p in samples)
