"""PIXEL LOCAL ② 덕력지도 — 5명 미만 숫자 비공개 · 하위 지역 합산 · 집계 참여자만 · 샘플 표시

다른 테스트·샘플 데이터와 섞이지 않게 테스트 전용 지역(TST › TST1 › TST1-01/02)을 만들었다가 지운다.
"""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app
from app.models import Region
from app.services import local_stats
from app.services.local_stats import period_start, present, rollup
from app.services.regions import build_tree

GHOST, MIMIC = 17, 18
TEST_REGIONS = [
    ("TST", "sido", None, "테스트시"),
    ("TST1", "sigungu", "TST", "테스트구"),
    ("TST1-01", "zone", "TST1", "가동"),
    ("TST1-02", "zone", "TST1", "나동"),
]


# --- 집계 규칙 (DB 없이) ---


def test_rollup_sums_children_into_parents():
    tree = build_tree(Region(code=c, level=lv, parent_code=p, name=n) for c, lv, p, n in TEST_REGIONS)
    total = rollup(tree, {("TST1-01", GHOST): 5, ("TST1-02", GHOST): 2, ("TST1-01", MIMIC): 3})
    assert total[("TST1-01", GHOST)] == 5
    assert total[("TST1", GHOST)] == 7
    assert total[("TST", GHOST)] == 7
    assert total[("TST", MIMIC)] == 3


def test_present_hides_numbers_below_five():
    assert present(5) == (5, False)
    assert present(4) == (None, True)
    assert present(1) == (None, True)


def test_period_start():
    now = datetime(2026, 10, 8, tzinfo=UTC)
    assert period_start("all", now) is None
    assert period_start("30d", now) == datetime(2026, 9, 8, tzinfo=UTC)


# --- API ---


@pytest.fixture
async def isolated_regions():
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
    yield
    async with engine.begin() as conn:
        await conn.execute(text("UPDATE users SET region_code = NULL WHERE region_code LIKE 'TST%'"))
        await conn.execute(text("DELETE FROM regions WHERE code LIKE 'TST%' AND level = 'zone'"))
        await conn.execute(text("DELETE FROM regions WHERE code LIKE 'TST%' AND level = 'sigungu'"))
        await conn.execute(text("DELETE FROM regions WHERE code LIKE 'TST%'"))


@pytest.fixture
def count_test_accounts(monkeypatch):
    # 이 테스트들의 사용자는 .test 이메일이라, 집계 규칙을 보려면 테스트 계정 제외를 잠시 끈다
    monkeypatch.setattr(local_stats, "EXCLUDED_EMAIL_SUFFIX", "@never.invalid")


async def set_profile(email: str, region: str, interest_ids: list[int], opt_in: bool = True) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/auth/dev-login", json={"email": email})
        res = await c.put(
            "/api/users/me/local",
            json={"regionCode": region, "interestIds": interest_ids, "fandomOptIn": opt_in},
        )
        assert res.status_code == 200


async def make_fans() -> None:
    # 가동: 고스트 5명 + 미믹 3명(겹침) / 나동: 고스트 2명 / 집계 미참여 1명
    for n in range(1, 6):
        await set_profile(f"fan-a{n}@pixelmart.test", "TST1-01", [GHOST, MIMIC] if n <= 3 else [GHOST])
    for n in range(1, 3):
        await set_profile(f"fan-b{n}@pixelmart.test", "TST1-02", [GHOST])
    await set_profile("fan-off@pixelmart.test", "TST1-01", [GHOST, MIMIC], opt_in=False)


def cells(rows: list[dict]) -> dict[tuple[str, int], tuple[int | None, bool]]:
    return {(r["regionCode"], r["interestId"]): (r["count"], r["belowThreshold"]) for r in rows}


async def test_zone_counts_and_below_threshold(client, isolated_regions, count_test_accounts):
    await make_fans()
    rows = (await client.get("/api/local/fandom", params={"region": "TST1-01"})).json()
    assert cells(rows) == {("TST1-01", GHOST): (5, False), ("TST1-01", MIMIC): (None, True)}
    assert rows[0]["regionName"] == "테스트시 테스트구 가동"
    assert rows[0]["isSample"] is False


async def test_parent_regions_sum_children(client, isolated_regions, count_test_accounts):
    await make_fans()
    district = cells((await client.get("/api/local/fandom", params={"region": "TST1"})).json())
    assert district[("TST1", GHOST)] == (7, False)
    city = cells((await client.get("/api/local/fandom", params={"region": "TST", "interest": GHOST})).json())
    assert city == {("TST", GHOST): (7, False)}
    zone_b = cells((await client.get("/api/local/fandom", params={"region": "TST1-02"})).json())
    assert zone_b == {("TST1-02", GHOST): (None, True)}


async def test_no_personal_info_in_response(client, isolated_regions, count_test_accounts):
    await make_fans()
    rows = (await client.get("/api/local/fandom", params={"region": "TST"})).json()
    keys = {"regionCode", "regionName", "interestId", "interest", "interestType", "count", "belowThreshold", "isSample"}
    assert rows and all(set(r) == keys for r in rows)
    assert "fan-" not in str(rows)


async def test_test_accounts_are_excluded_by_default(client, isolated_regions):
    await make_fans()
    assert (await client.get("/api/local/fandom", params={"region": "TST"})).json() == []


async def test_period_filter(client, isolated_regions, count_test_accounts):
    await make_fans()
    async with engine.begin() as conn:
        # 가동 고스트 팬 중 2명은 100일 전에 고른 것으로
        await conn.execute(
            text(
                "UPDATE user_interests SET created_at = now() - interval '100 days' "
                "WHERE interest_id = :g AND user_id IN (SELECT id FROM users WHERE email IN (:a, :b))"
            ),
            {"g": GHOST, "a": "fan-a4@pixelmart.test", "b": "fan-a5@pixelmart.test"},
        )
    recent = cells((await client.get("/api/local/fandom", params={"region": "TST1-01", "period": "90d"})).json())
    assert recent[("TST1-01", GHOST)] == (None, True)  # 3명
    everything = cells((await client.get("/api/local/fandom", params={"region": "TST1-01"})).json())
    assert everything[("TST1-01", GHOST)] == (5, False)


async def test_ranking_only_above_threshold(client, isolated_regions, count_test_accounts):
    await make_fans()
    ranking = (await client.get("/api/local/fandom/ranking", params={"region": "TST1"})).json()
    assert ranking == [
        {
            "rank": 1,
            "interestId": GHOST,
            "interest": "고스트",
            "interestType": "character",
            "count": 7,
            "isSample": False,
        }
    ]


async def test_sample_data_is_marked(client):
    # 시드 샘플: 판교 오로치마루 팬 12명 (실제 집계 참여자가 없는 칸)
    rows = (await client.get("/api/local/fandom", params={"region": "41135-01", "interest": 12})).json()
    if not rows:
        pytest.skip("덕력지도 샘플 시드 전입니다 (python -m scripts.seed)")
    assert rows == [
        {
            "regionCode": "41135-01",
            "regionName": "성남시 분당구 판교",
            "interestId": 12,
            "interest": "오로치마루",
            "interestType": "character",
            "count": 12,
            "belowThreshold": False,
            "isSample": True,
        }
    ]


@pytest.mark.parametrize(
    ("path", "params", "status_code"),
    [
        ("/api/local/fandom", {"region": "NOPE"}, 404),
        ("/api/local/fandom", {"interest": 99999}, 404),
        ("/api/local/fandom", {"period": "7d"}, 422),
        ("/api/local/fandom/ranking", {}, 422),
    ],
    ids=["unknown-region", "unknown-interest", "bad-period", "ranking-needs-region"],
)
async def test_invalid_filters(client, path, params, status_code):
    try:
        res = await client.get(path, params=params)
    except Exception:
        pytest.skip("로컬 DB가 없습니다")
    assert res.status_code == status_code
