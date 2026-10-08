"""리뷰 API — 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import json

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.db import engine
from app.services.reviews import round_average

BODY = {"recipientName": "홍길동", "address": "서울시 마포구 픽셀로 8"}
PRODUCT = 2  # 이 파일의 테스트는 모두 이 상품(과 아래 OTHER)만 쓴다
OTHER = 3


@pytest.fixture(autouse=True)
async def require_db():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1 FROM reviews LIMIT 1"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")
    # 재실행해도 같은 결과가 나오도록 이 테스트 계정의 이전 리뷰·주문을 지우고 시작
    async with engine.begin() as conn:
        ids = "SELECT id FROM users WHERE email LIKE 'review%@pixelmart.test'"
        await conn.execute(text(f"DELETE FROM reviews WHERE user_id IN ({ids})"))
        await conn.execute(text(f"DELETE FROM orders WHERE user_id IN ({ids})"))


async def login(client: AsyncClient, email: str) -> None:
    res = await client.post("/api/auth/dev-login", json={"email": email})
    assert res.status_code == 200
    for item in (await client.get("/api/cart")).json()["items"]:
        await client.delete(f"/api/cart/items/{item['product']['id']}")


async def buy(client: AsyncClient, email: str, product_id: int = PRODUCT, advance: int = 3) -> int:
    """로그인 → 상품 주문 → 배송을 advance번 진행(3이면 배송 완료)하고 주문 번호를 돌려준다"""
    await login(client, email)
    await client.post("/api/cart/items", json={"productId": product_id, "quantity": 1})
    order_id = (await client.post("/api/orders", json=BODY)).json()["id"]
    for _ in range(advance):
        await client.post(f"/api/dev/orders/{order_id}/advance")
    return order_id


def url(product_id: int = PRODUCT) -> str:
    return f"/api/products/{product_id}/reviews"


def review(rating: int = 5, content: str = "키감이 좋아요") -> dict:
    return {"rating": rating, "content": content}


# ---- 순수 함수 (DB 없이) ----
def test_round_average():
    assert round_average(0, 0) is None
    assert round_average(9, 2) == 4.5
    assert round_average(14, 3) == 4.7
    assert round_average(5, 1) == 5.0


# ---- 목록 ----
async def test_list_is_public_and_empty_has_null_average(client):
    res = await client.get(url())
    body = res.json()
    assert res.status_code == 200
    assert body["items"] == []
    assert body["total"] == 0
    assert body["averageRating"] is None


async def test_list_unknown_product_is_404(client):
    assert (await client.get(url(999999))).status_code == 404


async def test_list_rejects_oversized_page(client):
    assert (await client.get(url(), params={"size": 100})).status_code == 422


async def test_list_newest_first_with_average_and_paging(client):
    await buy(client, "review1@pixelmart.test")
    await client.post(url(), json=review(5, "첫 리뷰"))
    await buy(client, "review2@pixelmart.test")
    await client.post(url(), json=review(2, "두번째 리뷰"))

    body = (await client.get(url())).json()
    assert body["total"] == 2
    assert body["averageRating"] == 3.5
    assert [r["content"] for r in body["items"]] == ["두번째 리뷰", "첫 리뷰"]

    page2 = (await client.get(url(), params={"page": 2, "size": 1})).json()
    assert [r["content"] for r in page2["items"]] == ["첫 리뷰"]
    assert page2["totalPages"] == 2


async def test_list_shows_only_that_products_reviews(client):
    await buy(client, "review1@pixelmart.test")
    await client.post(url(), json=review())
    assert (await client.get(url(OTHER))).json()["total"] == 0


# ---- 작성 ----
async def test_post_requires_login(client):
    assert (await client.post(url(), json=review())).status_code == 401


async def test_post_unknown_product_is_404(client):
    await login(client, "review1@pixelmart.test")
    assert (await client.post(url(999999), json=review())).status_code == 404


async def test_post_without_purchase_is_403(client):
    await login(client, "review1@pixelmart.test")
    res = await client.post(url(), json=review())
    assert res.status_code == 403
    assert res.json()["detail"] == "배송이 완료된 상품만 리뷰를 작성할 수 있습니다."


@pytest.mark.parametrize("advance", [0, 1, 2])
async def test_post_before_delivery_is_403(client, advance):
    await buy(client, "review1@pixelmart.test", advance=advance)
    assert (await client.post(url(), json=review())).status_code == 403


async def test_post_for_cancelled_order_is_403(client):
    order_id = await buy(client, "review1@pixelmart.test", advance=0)
    request_id = (await client.post(f"/api/orders/{order_id}/cancel-requests", json={"reason": "변심"})).json()["id"]
    await client.post(f"/api/dev/cancel-requests/{request_id}/approve")
    assert (await client.post(url(), json=review())).status_code == 403


async def test_delivered_other_product_does_not_qualify(client):
    await buy(client, "review1@pixelmart.test", product_id=OTHER)  # 다른 상품을 받음
    assert (await client.post(url(PRODUCT), json=review())).status_code == 403


async def test_other_users_delivery_does_not_qualify(client):
    await buy(client, "review1@pixelmart.test")
    await login(client, "review2@pixelmart.test")  # 구매한 적 없는 다른 사람
    assert (await client.post(url(), json=review())).status_code == 403


async def test_post_after_delivery_creates_review_with_nickname_only(client):
    await buy(client, "review1@pixelmart.test")
    nickname = (await client.get("/api/auth/me")).json()["nickname"]  # 계정의 실제 닉네임
    res = await client.post(url(), json=review(5, "  키감이 좋아요  "))
    body = res.json()
    assert res.status_code == 201
    assert body["rating"] == 5
    assert body["content"] == "키감이 좋아요"
    assert body["nickname"] == nickname
    assert body["productId"] == PRODUCT

    listed = (await client.get(url())).json()
    assert listed["total"] == 1
    assert "pixelmart.test" not in json.dumps(listed)  # 이메일은 노출하지 않는다


async def test_duplicate_review_is_400_and_keeps_one(client):
    await buy(client, "review1@pixelmart.test")
    await client.post(url(), json=review(5))
    res = await client.post(url(), json=review(1, "또 씀"))
    assert res.status_code == 400
    assert res.json()["detail"] == "이미 리뷰를 작성한 상품입니다."
    body = (await client.get(url())).json()
    assert body["total"] == 1
    assert body["items"][0]["rating"] == 5


async def test_second_delivery_does_not_allow_second_review(client):
    await buy(client, "review1@pixelmart.test")
    await client.post(url(), json=review())
    await buy(client, "review1@pixelmart.test")  # 같은 상품을 한 번 더 받아도
    assert (await client.post(url(), json=review(3, "또"))).status_code == 400


@pytest.mark.parametrize(
    "payload",
    [
        {"rating": 0, "content": "a"},
        {"rating": 6, "content": "a"},
        {"rating": 5, "content": ""},
        {"rating": 5, "content": "   "},
        {"rating": 5, "content": "가" * 501},
        {"content": "별점 없음"},
        {"rating": 5},
    ],
)
async def test_invalid_input_is_422_and_nothing_saved(client, payload):
    await buy(client, "review1@pixelmart.test")
    assert (await client.post(url(), json=payload)).status_code == 422
    assert (await client.get(url())).json()["total"] == 0
