"""FAQ API 테스트 — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from sqlalchemy import text

from app.core.db import engine


@pytest.fixture(autouse=True)
async def require_faqs():
    try:
        async with engine.connect() as conn:
            count = await conn.scalar(text("SELECT count(*) FROM faqs"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head)")
    if not count:
        pytest.skip("FAQ 시드 전입니다 (python -m scripts.seed)")


async def test_list_faqs_returns_all_in_order(client):
    res = await client.get("/api/faqs")
    body = res.json()
    assert res.status_code == 200
    assert len(body) >= 10
    assert set(body[0]) == {"id", "category", "question", "answer"}
    assert [f["id"] for f in body] == sorted(f["id"] for f in body)


async def test_filter_faqs_by_category(client):
    res = await client.get("/api/faqs", params={"category": "배송"})
    body = res.json()
    assert res.status_code == 200
    assert body
    assert all(f["category"] == "배송" for f in body)


async def test_unknown_category_returns_empty_list(client):
    res = await client.get("/api/faqs", params={"category": "없는분류"})
    assert res.status_code == 200
    assert res.json() == []


async def test_too_long_category_is_rejected(client):
    res = await client.get("/api/faqs", params={"category": "a" * 31})
    assert res.status_code == 422
