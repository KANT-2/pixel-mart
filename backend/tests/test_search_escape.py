"""#83 검색어의 %·_·\는 와일드카드가 아니라 글자 그대로"""

import pytest

from app.services.search import escape_like, like_pattern


def test_escape_like_escapes_wildcards_and_backslash():
    assert escape_like(r"50%_a\b") == r"50\%\_a\\b"
    assert like_pattern("키캡") == "%키캡%"


@pytest.mark.usefixtures("require_db")
@pytest.mark.parametrize("q", ["%", "_", "%%", "\\"])
async def test_product_search_treats_wildcards_as_text(client, q):
    res = await client.get("/api/products", params={"q": q, "size": 60})
    assert res.status_code == 200
    # 상품 이름·설명에 이 글자가 없으므로 전체가 아니라 0개
    assert res.json()["total"] == 0


@pytest.mark.usefixtures("require_db")
async def test_normal_product_search_still_matches(client):
    res = await client.get("/api/products", params={"q": "키캡", "size": 60})
    assert res.status_code == 200
    assert res.json()["total"] > 0


@pytest.mark.usefixtures("require_db")
async def test_interest_and_keyboard_search_escape(client):
    interests = await client.get("/api/interests", params={"q": "%"})
    assert interests.status_code == 200 and interests.json() == []
    keyboards = await client.get("/api/keyboards", params={"q": "_"})
    assert keyboards.status_code == 200 and keyboards.json() == []
