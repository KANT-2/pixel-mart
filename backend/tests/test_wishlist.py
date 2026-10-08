"""찜 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.main import app


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM wishlists LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200
    # 재실행해도 같은 결과가 나오도록 찜 목록을 비우고 시작
    for item in (await client.get("/api/wishlist", params={"size": 60})).json()["items"]:
        await client.delete(f"/api/wishlist/{item['product']['id']}")


async def test_wishlist_requires_login(client):
    assert (await client.get("/api/wishlist")).status_code == 401
    assert (await client.put("/api/wishlist/1")).status_code == 401


async def test_add_and_list_newest_first(client):
    await login(client, "wish1@pixelmart.test")
    res = await client.put("/api/wishlist/10")
    assert res.status_code == 200
    assert res.json()["product"]["id"] == 10
    assert "createdAt" in res.json()
    await client.put("/api/wishlist/20")

    body = (await client.get("/api/wishlist")).json()
    assert body["total"] == 2
    assert [i["product"]["id"] for i in body["items"]] == [20, 10]


async def test_add_twice_keeps_one(client):
    await login(client, "wish2@pixelmart.test")
    first = (await client.put("/api/wishlist/3")).json()
    second = (await client.put("/api/wishlist/3")).json()
    assert first["createdAt"] == second["createdAt"]
    assert (await client.get("/api/wishlist")).json()["total"] == 1


async def test_add_missing_product_is_404(client):
    await login(client, "wish3@pixelmart.test")
    assert (await client.put("/api/wishlist/999")).status_code == 404


async def test_remove(client):
    await login(client, "wish4@pixelmart.test")
    await client.put("/api/wishlist/5")

    res = await client.delete("/api/wishlist/5")
    assert res.status_code == 200
    assert (await client.get("/api/wishlist")).json()["total"] == 0
    assert (await client.delete("/api/wishlist/5")).status_code == 404


async def test_pagination(client):
    await login(client, "wish5@pixelmart.test")
    for product_id in range(1, 6):
        await client.put(f"/api/wishlist/{product_id}")

    body = (await client.get("/api/wishlist", params={"page": 2, "size": 2})).json()
    assert body["total"] == 5
    assert body["totalPages"] == 3
    assert [i["product"]["id"] for i in body["items"]] == [3, 2]


async def test_wishlists_are_separated_by_user(client):
    await login(client, "wish6@pixelmart.test")
    await client.put("/api/wishlist/7")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as other:
        await login(other, "wish7@pixelmart.test")
        assert (await other.get("/api/wishlist")).json()["total"] == 0
        # 남의 찜은 404로 숨김
        assert (await other.delete("/api/wishlist/7")).status_code == 404

    assert (await client.get("/api/wishlist")).json()["total"] == 1
