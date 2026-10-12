"""상품 아이템 등급 — 가격 경계값 · 등급별 카테고리 · 등급 필터 (API는 로컬 DB 필요)"""

import re
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core.db import engine
from app.services.rarity import TIERS, rarity_of


@pytest.mark.parametrize(
    ("price", "expected"),
    [
        (0, "common"),
        (9_999, "common"),
        (10_000, "rare"),
        (19_999, "rare"),
        (20_000, "epic"),
        (29_999, "epic"),
        (30_000, "unique"),
        (1_000_000, "unique"),
    ],
)
def test_rarity_boundaries(price, expected):
    assert rarity_of(price) == expected


def test_tiers_match_frontend_rarity_of():
    # 프론트 utils/gameItem.ts rarityOf의 `price < N` 경계와 백엔드 등급 구간이 같은지 (한쪽만 바꾸면 실패)
    source = Path(__file__).resolve().parents[2] / "utils" / "gameItem.ts"
    if not source.exists():
        pytest.skip("프론트 utils/gameItem.ts가 없습니다")
    body = source.read_text(encoding="utf-8").split("export function rarityOf", 1)[1].split("\n}", 1)[0]
    frontend = [int(n.replace("_", "")) for n in re.findall(r"price < ([\d_]+)", body)]
    backend = [t.max_price for t in TIERS if t.max_price is not None]
    assert frontend == backend


@pytest.fixture
async def db_ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM products LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 시드 전입니다 (alembic upgrade head → python -m scripts.seed)")


async def test_rarities_cover_all_products(client, db_ready):
    rarities = (await client.get("/api/rarities")).json()
    assert [r["key"] for r in rarities] == ["common", "rare", "epic", "unique"]
    assert rarities[0] == {**rarities[0], "label": "COMMON", "minPrice": 0, "maxPrice": 10_000}
    assert rarities[-1]["maxPrice"] is None
    total = (await client.get("/api/products", params={"size": 1})).json()["total"]
    assert sum(r["count"] for r in rarities) == total


async def test_rarities_within_category(client, db_ready):
    rarities = (await client.get("/api/rarities", params={"category": "keycap"})).json()
    keycaps = (await client.get("/api/products", params={"category": "keycap", "size": 1})).json()["total"]
    assert sum(r["count"] for r in rarities) == keycaps


async def test_product_items_carry_rarity(client, db_ready):
    items = (await client.get("/api/products", params={"size": 60})).json()["items"]
    assert items and all(item["rarity"] == rarity_of(item["price"]) for item in items)
    detail = (await client.get(f"/api/products/{items[0]['id']}")).json()
    assert detail["rarity"] == rarity_of(detail["price"])


async def test_filter_by_rarity_matches_counts(client, db_ready):
    counts = {r["key"]: r["count"] for r in (await client.get("/api/rarities")).json()}

    epic = (await client.get("/api/products", params={"rarity": "unique", "size": 60})).json()
    assert epic["total"] == counts["unique"]
    assert all(item["price"] >= 30_000 and item["rarity"] == "unique" for item in epic["items"])

    both = (await client.get("/api/products", params={"rarity": "common,UNIQUE", "size": 1})).json()
    assert both["total"] == counts["common"] + counts["unique"]


async def test_rarity_with_category(client, db_ready):
    counts = {r["key"]: r["count"] for r in (await client.get("/api/rarities", params={"category": "keycap"})).json()}
    res = (await client.get("/api/products", params={"rarity": "common", "category": "keycap", "size": 60})).json()
    assert res["total"] == counts["common"]
    assert {item["categorySlug"] for item in res["items"]} <= {"keycap"}


async def test_unknown_rarity_is_422(client, db_ready):
    res = await client.get("/api/products", params={"rarity": "legendary"})
    assert res.status_code == 422
    assert "legendary" in res.json()["detail"]
