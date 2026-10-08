"""DB가 필요한 테스트 — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from sqlalchemy import text

from app.core.db import engine


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM products LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 시드 전입니다 (alembic upgrade head → python -m scripts.seed)")


async def test_list_products_paginates(client):
    res = await client.get("/api/products", params={"page": 2, "size": 12})
    body = res.json()
    assert res.status_code == 200
    assert body["total"] == 180
    assert body["totalPages"] == 15
    assert len(body["items"]) == 12


async def test_filter_by_category(client):
    res = await client.get("/api/products", params={"category": "keycap", "size": 60})
    body = res.json()
    assert body["total"] == 30
    assert {item["categorySlug"] for item in body["items"]} == {"keycap"}


async def test_product_detail_and_404(client):
    ok = await client.get("/api/products/1")
    assert ok.json()["name"] == "HP 하트 키캡"
    assert ok.json()["imageUrl"].endswith(".webp")

    missing = await client.get("/api/products/999")
    assert missing.status_code == 404


async def test_dev_login_sets_cookie(client):
    res = await client.post("/api/auth/dev-login", json={"email": "player1@pixelmart.test"})
    assert res.status_code == 200
    assert "pm_session" in res.cookies

    me = await client.get("/api/auth/me")
    assert me.json()["email"] == "player1@pixelmart.test"
