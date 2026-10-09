"""PIXEL LOCAL ① 지역·취향 설정 — 로컬 DB에 마이그레이션·시드 후 실행 (없으면 건너뜀)"""

import pytest
from sqlalchemy import text

from app.core.db import engine
from app.models import Region
from app.services.regions import build_tree


@pytest.fixture
async def db_ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM regions, interests LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션·시드 전입니다 (alembic upgrade head → python -m scripts.seed)")


# --- 지역 계층 (DB 없이) ---

TREE = build_tree(
    [
        Region(code="41130", level="sido", parent_code=None, name="성남시"),
        Region(code="41135", level="sigungu", parent_code="41130", name="분당구"),
        Region(code="41135-01", level="zone", parent_code="41135", name="판교"),
    ]
)


def test_region_tree():
    assert TREE.ancestors("41135-01") == ["41135-01", "41135", "41130"]
    assert TREE.full_name("41135-01") == "성남시 분당구 판교"
    assert TREE.district_of("41135-01") == "41135"
    assert TREE.district_of("41135") == "41135"
    assert TREE.district_of("41130") is None


# --- API ---


async def test_regions_by_level(client, db_ready):
    cities = (await client.get("/api/regions")).json()
    assert {r["level"] for r in cities} == {"sido"}
    assert "성남시" in [r["name"] for r in cities]

    districts = (await client.get("/api/regions", params={"parent": "41130"})).json()
    assert [r["name"] for r in districts] == ["수정구", "분당구"]

    zones = (await client.get("/api/regions", params={"parent": "41135"})).json()
    pangyo = next(z for z in zones if z["name"] == "판교")
    assert pangyo == {
        "code": "41135-01",
        "level": "zone",
        "parentCode": "41135",
        "name": "판교",
        "fullName": "성남시 분당구 판교",
    }
    assert (await client.get("/api/regions", params={"parent": "NOPE"})).status_code == 404


async def test_interests_types_and_search(client, db_ready):
    characters = (await client.get("/api/interests", params={"type": "character"})).json()
    assert {i["type"] for i in characters} == {"character"}
    assert next(i for i in characters if i["name"] == "오로치마루")["parentId"] == 1  # 작품 > 캐릭터

    product_types = (await client.get("/api/interests", params={"type": "product_type"})).json()
    assert "키캡" in [i["name"] for i in product_types]
    assert [i["name"] for i in (await client.get("/api/interests", params={"q": "Ret"})).json()] == ["Retro"]
    assert (await client.get("/api/interests", params={"type": "genre"})).status_code == 422


async def test_local_profile_requires_login(client, db_ready):
    assert (await client.get("/api/users/me/local")).status_code == 401
    assert (await client.put("/api/users/me/local", json={})).status_code == 401


async def test_put_and_get_local_profile(client, db_ready):
    await client.post("/api/auth/dev-login", json={"email": "local1@pixelmart.test"})
    body = {"regionCode": "41135-01", "interestIds": [71, 12, 12, 51], "fandomOptIn": True, "profilePublic": False}
    res = await client.put("/api/users/me/local", json=body)
    assert res.status_code == 200
    profile = res.json()
    assert profile["region"]["fullName"] == "성남시 분당구 판교"
    assert sorted(i["id"] for i in profile["interests"]) == [12, 51, 71]  # 중복은 한 번만
    assert (profile["fandomOptIn"], profile["profilePublic"]) == (True, False)
    assert (await client.get("/api/users/me/local")).json() == profile


async def test_put_keeps_selected_time_of_unchanged_interests(client, db_ready):
    me = (await client.post("/api/auth/dev-login", json={"email": "local2@pixelmart.test"})).json()
    await client.put("/api/users/me/local", json={"interestIds": []})
    await client.put("/api/users/me/local", json={"interestIds": [12, 51]})

    async def selected_at():
        async with engine.connect() as conn:
            rows = await conn.execute(
                text("SELECT interest_id, created_at FROM user_interests WHERE user_id = :u"), {"u": me["id"]}
            )
            return dict(rows.all())

    before = await selected_at()
    await client.put("/api/users/me/local", json={"interestIds": [12, 71]})
    after = await selected_at()
    assert set(after) == {12, 71}
    assert after[12] == before[12]


async def test_clear_local_profile(client, db_ready):
    await client.post("/api/auth/dev-login", json={"email": "local3@pixelmart.test"})
    await client.put("/api/users/me/local", json={"regionCode": "11680", "interestIds": [11], "fandomOptIn": True})
    cleared = (await client.put("/api/users/me/local", json={"regionCode": None, "interestIds": []})).json()
    assert cleared == {
        "region": None,
        "interests": [],
        "fandomOptIn": False,
        "profilePublic": False,
        "mapAvatarOptIn": False,
    }


@pytest.mark.parametrize(
    "body",
    [{"regionCode": "99999"}, {"interestIds": [12, 9999]}, {"interestIds": list(range(1, 22))}],
    ids=["unknown-region", "unknown-interest", "too-many-interests"],
)
async def test_invalid_local_profile_is_422(client, db_ready, body):
    await client.post("/api/auth/dev-login", json={"email": "local4@pixelmart.test"})
    before = (await client.get("/api/users/me/local")).json()
    assert (await client.put("/api/users/me/local", json=body)).status_code == 422
    assert (await client.get("/api/users/me/local")).json() == before
