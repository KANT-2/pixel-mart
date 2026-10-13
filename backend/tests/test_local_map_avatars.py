"""덕력지도 아바타 핀 — 동의자만, 1명부터 공개(0명만 숨김), 개인 식별 정보 없음 (로컬 DB 필요, 없으면 건너뜀)

다른 테스트·샘플과 섞이지 않게 테스트 전용 지역(AVT › AVT1·AVT2 › 생활권)을 만들고 끝나면 정리한다.
"""

import json
from contextlib import AsyncExitStack

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from app.routers import local as local_router
from app.routers.local import MAX_MAP_AVATARS
from app.services import local_stats
from app.services.sample_avatars import sample_pool

ZONE_A, ZONE_B, OTHER = "AVT1-01", "AVT1-02", "AVT2-01"
TEST_REGIONS = [
    ("AVT", "sido", None, "아바타시"),
    ("AVT1", "sigungu", "AVT", "일구"),
    ("AVT2", "sigungu", "AVT", "이구"),
    ("AVT1-01", "zone", "AVT1", "가동"),
    ("AVT1-02", "zone", "AVT1", "나동"),
    ("AVT2-01", "zone", "AVT2", "다동"),
]
NARUTO = 1  # 작품
ORDER_SQL = text(
    "INSERT INTO orders (user_id, status, total_price, recipient_name, address) "
    "SELECT id, :status, :total, '테스트', '테스트 주소' FROM users WHERE email = :email"
)
PNG = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture
async def users(monkeypatch):
    """users(email, region, opt_in, avatar, interests) → 로그인된 클라이언트"""
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
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")

    async with AsyncExitStack() as stack:

        async def make(
            email: str, region: str = ZONE_A, opt_in: bool = True, avatar: bool = False, interests=(), public=False
        ) -> AsyncClient:
            c = await stack.enter_async_context(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
            await c.post("/api/auth/dev-login", json={"email": email})
            body = {
                "regionCode": region,
                "interestIds": list(interests),
                "mapAvatarOptIn": opt_in,
                "nicknamePublic": public,
            }
            assert (await c.put("/api/users/me/local", json=body)).status_code == 200
            if avatar:
                await c.put("/api/users/me/avatar", json={"avatarUrl": avatar if isinstance(avatar, str) else PNG})
            else:
                await c.delete("/api/users/me/avatar")
            return c

        yield make

    async with engine.begin() as conn:
        await conn.execute(
            text("UPDATE users SET region_code = NULL, map_avatar_opt_in = false WHERE region_code LIKE 'AVT%'")
        )
        for level in ("zone", "sigungu", "sido"):
            await conn.execute(text("DELETE FROM regions WHERE code LIKE 'AVT%' AND level = :l"), {"l": level})


def blocks(rows: list[dict]) -> dict[str, dict]:
    return {r["regionCode"]: r for r in rows}


async def test_opt_in_is_off_by_default_and_saved(users):
    c = await users("avatar-default@pixelmart.test", opt_in=False)
    assert (await c.get("/api/users/me/local")).json()["mapAvatarOptIn"] is False
    body = {"regionCode": ZONE_A, "interestIds": [], "mapAvatarOptIn": True}
    assert (await c.put("/api/users/me/local", json=body)).json()["mapAvatarOptIn"] is True


async def test_small_group_shows_count_and_avatars(users):
    for n in range(4):
        await users(f"avatar-few{n}@pixelmart.test", avatar=True)
    rows = blocks(
        (
            await (await users("avatar-viewer@pixelmart.test", opt_in=False)).get(
                "/api/local/map-avatars", params={"region": "AVT1"}
            )
        ).json()
    )
    assert rows[ZONE_A] == {
        "regionCode": ZONE_A,
        "regionName": "아바타시 일구 가동",
        "count": 4,
        "belowThreshold": False,
        "avatars": [PNG] * 4,
        "isSample": False,
        "cards": [None] * 4,  # 카드 공개 동의 안 함
    }
    assert rows[ZONE_B]["count"] is None and rows[ZONE_B]["belowThreshold"] is True  # 0명만 숨김
    assert rows[ZONE_B]["avatars"] == []


async def test_five_opted_in_show_avatars_without_identity(users):
    for n in range(3):
        await users(f"avatar-a{n}@pixelmart.test", avatar=True)
    for n in range(2):
        await users(f"avatar-b{n}@pixelmart.test")  # 아바타 없음 → 기본 슬라임(null)
    await users("avatar-off@pixelmart.test", opt_in=False, avatar=True)  # 동의 안 함 → 제외
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)

    res = await viewer.get("/api/local/map-avatars", params={"region": "AVT1"})
    zone = blocks(res.json())[ZONE_A]
    assert zone["count"] == 5 and zone["belowThreshold"] is False
    assert sorted(zone["avatars"], key=str) == sorted([PNG] * 3 + [None] * 2, key=str)
    raw = json.dumps(res.json())
    assert "pixelmart.test" not in raw and "avatar-a0" not in raw  # 이메일·닉네임 없음
    assert set(zone) == {"regionCode", "regionName", "count", "belowThreshold", "avatars", "isSample", "cards"}
    assert zone["isSample"] is False
    assert zone["cards"] == [None] * 5  # 카드 공개에 동의하지 않으면 카드 없음


async def test_parent_block_sums_children(users):
    for n in range(4):
        await users(f"avatar-za{n}@pixelmart.test", region=ZONE_A)
    for n in range(4):
        await users(f"avatar-zb{n}@pixelmart.test", region=ZONE_B)
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    top = blocks((await viewer.get("/api/local/map-avatars", params={"region": "AVT"})).json())
    assert top["AVT1"]["count"] == 8 and len(top["AVT1"]["avatars"]) == 8  # 하위 합산, 10명까지는 인원만큼
    assert top["AVT2"]["belowThreshold"] is True


async def test_interest_filter_and_leaf_region(users):
    for n in range(5):
        await users(f"avatar-n{n}@pixelmart.test", interests=[NARUTO])
    await users("avatar-x@pixelmart.test")
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    zone = (await viewer.get("/api/local/map-avatars", params={"region": ZONE_A, "interest": NARUTO})).json()
    assert [(r["regionCode"], r["count"]) for r in zone] == [(ZONE_A, 5)]  # 생활권은 자기 자신 한 칸


async def test_avatars_ordered_by_purchase_total(users):
    pool = sample_pool()
    spend = {"avatar-rich": 90_000, "avatar-mid": 30_000, "avatar-cancel": 0}
    for n, name in enumerate([*spend, "avatar-none0", "avatar-none1"]):
        await users(f"{name}@pixelmart.test", avatar=pool[n])
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    async with engine.begin() as conn:
        for name, total in [("avatar-rich", 50_000), ("avatar-rich", 40_000), ("avatar-mid", 30_000)]:
            await conn.execute(ORDER_SQL, {"email": f"{name}@pixelmart.test", "total": total, "status": "delivered"})
        # 취소한 주문은 구매 금액에 넣지 않는다
        await conn.execute(
            ORDER_SQL, {"email": "avatar-cancel@pixelmart.test", "total": 999_000, "status": "cancelled"}
        )
    try:
        zone = blocks((await viewer.get("/api/local/map-avatars", params={"region": "AVT1"})).json())[ZONE_A]
        assert zone["avatars"][:2] == [pool[0], pool[1]]
        assert sorted(zone["avatars"][2:]) == sorted(pool[2:5])
    finally:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "DELETE FROM orders WHERE user_id IN "
                    "(SELECT id FROM users WHERE email LIKE 'avatar-%@pixelmart.test')"
                )
            )


async def test_caps_avatars_per_block(users, monkeypatch):
    assert MAX_MAP_AVATARS == 10
    monkeypatch.setattr(local_router, "MAX_MAP_AVATARS", 3)  # 50명을 만들지 않고 상한만 확인
    for n in range(5):
        await users(f"avatar-cap{n}@pixelmart.test")
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    zone = blocks((await viewer.get("/api/local/map-avatars", params={"region": "AVT1"})).json())[ZONE_A]
    assert zone["count"] == 5 and len(zone["avatars"]) == 3


async def test_sample_characters_fill_quiet_regions(client):
    try:
        rows = (await client.get("/api/local/map-avatars")).json()
    except Exception:
        pytest.skip("로컬 DB가 없습니다")
    samples = [r for r in rows if r["isSample"]]
    if not samples:
        pytest.skip("덕력지도 샘플이 없거나 실제 동의자가 충분합니다 (python -m scripts.seed)")
    for r in samples:
        assert r["count"] >= 5 and len(r["avatars"]) == min(r["count"], 10)
        # 실제 이웃이 섞이면 아바타가 없는 사람(null = 기본 슬라임)도 있다
        assert all(a is None or a.startswith("data:image/png;base64,") for a in r["avatars"])
    again = (await client.get("/api/local/map-avatars")).json()

    def fakes(rows):  # 샘플 캐릭터 부분만 (실제 이웃은 같은 금액이면 순서가 무작위)
        return [
            [a for a, c in zip(r["avatars"], r["cards"], strict=True) if c and c["isSample"]]
            for r in rows
            if r["isSample"]
        ]

    assert fakes(again) == fakes(samples)  # 샘플 캐릭터는 늘 같은 구성


@pytest.mark.parametrize(("params", "status_code"), [({"region": "NOPE"}, 404), ({"interest": 99999}, 404)])
async def test_validation(client, params, status_code):
    assert (await client.get("/api/local/map-avatars", params=params)).status_code == status_code


async def test_buyer_ranking_hides_amounts_and_private_nicknames(users):
    pool = sample_pool()
    names = ["avatar-rich", "avatar-mid", "avatar-none0", "avatar-none1", "avatar-none2"]
    for n, name in enumerate(names):
        await users(f"{name}@pixelmart.test", avatar=pool[n], public=name == "avatar-rich")
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    async with engine.begin() as conn:
        for name, total in [("avatar-rich", 77_777), ("avatar-mid", 33_333)]:
            await conn.execute(ORDER_SQL, {"email": f"{name}@pixelmart.test", "total": total, "status": "paid"})
    try:
        res = await viewer.get("/api/local/buyer-ranking", params={"region": "AVT1"})
        body = res.json()
        assert res.status_code == 200 and body["belowThreshold"] is False and body["isSample"] is False
        assert [i["rank"] for i in body["items"]] == [1, 2, 3, 4, 5]
        assert [i["avatarUrl"] for i in body["items"][:2]] == [pool[0], pool[1]]
        assert body["items"][0]["nickname"] is not None  # 닉네임 공개 동의자
        assert all(i["nickname"] is None for i in body["items"][1:])  # 비동의자는 숨김
        raw = json.dumps(body)
        assert "77777" not in raw and "33333" not in raw and "pixelmart.test" not in raw  # 금액·이메일 없음
        assert set(body["items"][0]) == {"rank", "avatarUrl", "nickname"}
    finally:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "DELETE FROM orders WHERE user_id IN "
                    "(SELECT id FROM users WHERE email LIKE 'avatar-%@pixelmart.test')"
                )
            )


async def test_buyer_ranking_lists_small_group_and_hides_empty(users):
    for n in range(4):
        await users(f"avatar-few{n}@pixelmart.test")
    viewer = await users("avatar-viewer@pixelmart.test", region=OTHER, opt_in=False)
    body = (await viewer.get("/api/local/buyer-ranking", params={"region": ZONE_A})).json()
    items = [{"rank": n, "avatarUrl": None, "nickname": None} for n in range(1, 5)]  # 아바타·닉네임 공개 없음
    assert body == {"regionCode": ZONE_A, "belowThreshold": False, "isSample": False, "items": items}
    empty = (await viewer.get("/api/local/buyer-ranking", params={"region": ZONE_B})).json()
    assert empty == {"regionCode": ZONE_B, "belowThreshold": True, "isSample": False, "items": []}


async def test_buyer_ranking_sample_top_ten(client):
    try:
        rows = (await client.get("/api/local/map-avatars")).json()
    except Exception:
        pytest.skip("로컬 DB가 없습니다")
    sample = next((r for r in rows if r["isSample"]), None)
    if sample is None:
        pytest.skip("덕력지도 샘플이 없거나 실제 동의자가 충분합니다")
    body = (await client.get("/api/local/buyer-ranking", params={"region": sample["regionCode"]})).json()
    assert body["isSample"] is True and len(body["items"]) == 10
    assert [i["avatarUrl"] for i in body["items"]] == sample["avatars"][:10]  # 지도 핀 1~10위와 같은 순서
    assert all(i["nickname"] for i in body["items"])


@pytest.mark.parametrize(("params", "status_code"), [({"region": "NOPE"}, 404), ({}, 422)])
async def test_buyer_ranking_validation(client, params, status_code):
    assert (await client.get("/api/local/buyer-ranking", params=params)).status_code == status_code
