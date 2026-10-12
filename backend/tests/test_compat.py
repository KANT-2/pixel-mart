"""키캡 호환성 — 판정 규칙·시드 검증은 DB 없이, API는 로컬 DB에 마이그레이션·시드 후 실행 (DB가 없으면 건너뜀)"""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from app.core.db import engine
from app.services.compat import check_compatibility

SEED = Path(__file__).resolve().parent.parent / "seed"
KNOWN_KEYS = {"1u", "accent4", "esc", "6.25u", "arrows"}


def keyboard(**overrides) -> SimpleNamespace:
    base = {
        "id": 1,
        "maker": "Test",
        "model": "Board",
        "stem": "MX",
        "profile_support": ["cherry"],
        "esc_size": "1u",
        "spacebar_size": "6.25u",
        "has_arrow_cluster": True,
    }
    return SimpleNamespace(**{**base, **overrides})


def spec(key_sizes=("1u",), profile="cherry", stem="MX") -> SimpleNamespace:
    return SimpleNamespace(product_id=1, profile=profile, stem=stem, key_sizes=list(key_sizes))


def statuses(verdict) -> dict[str, str]:
    return {c.key: c.status for c in verdict.checks}


# ---- 판정 규칙 (DB 없이) ----
def test_everything_matches_is_compatible():
    v = check_compatibility(keyboard(), spec(["1u"]))
    assert v.result == "compatible"
    assert v.result_label == "모두 장착 가능"
    assert [c.key for c in v.checks] == ["stem", "profile", "keys"]  # 축 → 프로파일 → 키 순서
    assert all(c.status == "compatible" for c in v.checks)


def test_stem_mismatch_is_incompatible_even_if_everything_else_matches():
    v = check_compatibility(keyboard(stem="LOW"), spec(["1u"]))
    assert v.result == "incompatible"
    assert statuses(v)["stem"] == "incompatible"
    assert "축" in v.summary


def test_stem_mismatch_beats_partial_keys():
    v = check_compatibility(keyboard(stem="LOW", has_arrow_cluster=False), spec(["1u", "arrows"]))
    assert v.result == "incompatible"


def test_profile_mismatch_is_partial_not_incompatible():
    v = check_compatibility(keyboard(profile_support=["oem"]), spec(["1u"]))
    assert v.result == "partial"
    assert statuses(v)["profile"] == "partial"
    assert v.result_label == "일부 호환"


@pytest.mark.parametrize(("esc_size", "expected"), [("1u", "compatible"), ("1.5u", "incompatible")])
def test_esc_key_size(esc_size, expected):
    v = check_compatibility(keyboard(esc_size=esc_size), spec(["esc"]))
    assert statuses(v)["esc"] == expected
    assert v.result == expected


@pytest.mark.parametrize(("size", "expected"), [("6.25u", "compatible"), ("7u", "incompatible")])
def test_spacebar_size(size, expected):
    v = check_compatibility(keyboard(spacebar_size=size), spec(["6.25u"]))
    assert statuses(v)["spacebar"] == expected
    assert v.result == expected


@pytest.mark.parametrize(("has_arrows", "expected"), [(True, "compatible"), (False, "incompatible")])
def test_arrow_cluster(has_arrows, expected):
    v = check_compatibility(keyboard(has_arrow_cluster=has_arrows), spec(["arrows"]))
    assert statuses(v)["arrows"] == expected
    assert v.result == expected


@pytest.mark.parametrize("token", ["1u", "accent4"])
def test_one_u_keys_fit_any_keyboard_with_matching_stem(token):
    v = check_compatibility(keyboard(esc_size="1.5u", spacebar_size="7u", has_arrow_cluster=False), spec([token]))
    assert v.result == "compatible"


def test_some_keys_fit_is_partial():
    """여러 키를 덮는 세트에서 일부만 맞으면 '일부 키만 장착 가능'"""
    v = check_compatibility(keyboard(has_arrow_cluster=False), spec(["1u", "arrows"]))
    assert v.result == "partial"
    assert v.summary == "일부 키만 장착할 수 있어요."
    assert statuses(v)["arrows"] == "incompatible"


def test_all_keys_fail_is_incompatible():
    v = check_compatibility(keyboard(esc_size="1.5u", spacebar_size="7u"), spec(["esc", "6.25u"]))
    assert v.result == "incompatible"


def test_unknown_key_kind_raises():
    with pytest.raises(ValueError, match="알 수 없는 키 종류"):
        check_compatibility(keyboard(), spec(["mystery"]))


def test_failure_messages_name_the_actual_sizes():
    v = check_compatibility(keyboard(spacebar_size="7u"), spec(["6.25u"]))
    [bad] = [c for c in v.checks if c.status == "incompatible"]
    assert "7u" in bad.message
    assert "6.25u" in bad.message


# ---- 시드 데이터 (DB 없이, JSON 파일만) ----
def load(name: str) -> list[dict]:
    return json.loads((SEED / name).read_text(encoding="utf-8"))


def test_seed_keyboards_are_valid():
    keyboards = load("keyboards.json")
    assert len({k["id"] for k in keyboards}) == len(keyboards)
    assert len({(k["maker"], k["model"]) for k in keyboards}) == len(keyboards)
    assert {k["layout"] for k in keyboards} <= {"ANSI", "ISO"}
    assert all(k["profileSupport"] for k in keyboards)


def test_seed_keycap_specs_cover_exactly_the_keycap_products():
    products = load("products.json")
    keycap_ids = {p["id"] for p in products if p["category"] == "키캡"}
    specs = load("keycap_specs.json")
    spec_ids = [s["productId"] for s in specs]
    assert len(spec_ids) == len(set(spec_ids))  # 상품당 규격 한 줄
    assert set(spec_ids) == keycap_ids  # 키캡 상품 전부에 규격이 있고, 키캡이 아닌 상품에는 없다
    assert all(set(s["keySizes"]) <= KNOWN_KEYS for s in specs)


def test_every_keyboard_and_keycap_combination_can_be_judged():
    keyboards = [
        keyboard(
            id=k["id"],
            stem=k["stem"],
            profile_support=k["profileSupport"],
            esc_size=k["escSize"],
            spacebar_size=k["spacebarSize"],
            has_arrow_cluster=k["hasArrowCluster"],
        )
        for k in load("keyboards.json")
    ]
    specs = [spec(s["keySizes"], s["profile"], s["stem"]) for s in load("keycap_specs.json")]
    results = {check_compatibility(k, s).result for k in keyboards for s in specs}  # 오타가 있으면 여기서 ValueError
    assert results == {"compatible", "partial", "incompatible"}  # 시연에서 세 가지 결과가 모두 나온다


# ---- API (로컬 DB) ----
@pytest.fixture
async def seeded():
    try:
        async with engine.connect() as conn:
            keyboards = await conn.scalar(text("SELECT count(*) FROM keyboards"))
            specs = await conn.scalar(text("SELECT count(*) FROM keycap_specs"))
    except Exception:
        pytest.skip("로컬 DB가 없거나 마이그레이션 전입니다 (alembic upgrade head → python -m scripts.seed)")
    if not keyboards or not specs:
        pytest.skip("호환성 시드 전입니다 (python -m scripts.seed)")


KB = {"K8": 1, "K2": 2, "Board60": 3, "Slim75": 6, "Wide7U": 7, "Mini40": 8}
PRODUCT = {"cherry": 1, "esc": 15, "spacebar": 21, "arrows": 27, "metal": 45, "not_keycap": 3}


async def judge(client, keyboard_id: int, product_id: int):
    return await client.get("/api/compatibility", params={"keyboardId": keyboard_id, "productId": product_id})


async def test_list_keyboards_is_public(client, seeded):
    res = await client.get("/api/keyboards")
    body = res.json()
    assert res.status_code == 200
    assert len(body) >= 8
    assert set(body[0]) == {
        "id", "name", "maker", "model", "layout", "stem",
        "profileSupport", "escSize", "spacebarSize", "hasArrowCluster",
    }  # fmt: skip
    assert "Keychron K8" in [k["name"] for k in body]


async def test_filter_keyboards_by_maker_ignores_case(client, seeded):
    body = (await client.get("/api/keyboards", params={"maker": "keychron"})).json()
    assert {k["maker"] for k in body} == {"Keychron"}
    assert len(body) >= 2


async def test_search_keyboards_by_text(client, seeded):
    body = (await client.get("/api/keyboards", params={"q": "board"})).json()
    assert body
    assert all("board" in k["name"].lower() for k in body)


async def test_search_with_no_match_returns_empty_list(client, seeded):
    res = await client.get("/api/keyboards", params={"q": "존재하지않는키보드"})
    assert res.status_code == 200
    assert res.json() == []


async def test_search_rejects_too_long_text(client, seeded):
    assert (await client.get("/api/keyboards", params={"q": "a" * 51})).status_code == 422


@pytest.mark.parametrize(
    ("keyboard_id", "product", "expected"),
    [
        (KB["K8"], "spacebar", "compatible"),
        (KB["Wide7U"], "spacebar", "incompatible"),  # 스페이스바 7u
        (KB["Slim75"], "cherry", "incompatible"),  # 로우프로파일 축
        (KB["K2"], "metal", "partial"),  # 프로파일 미지원
        (KB["Board60"], "arrows", "incompatible"),  # 방향키 없음
        (KB["Mini40"], "esc", "incompatible"),  # ESC 1.5u
        (KB["Mini40"], "cherry", "partial"),  # cherry 프로파일 미지원
    ],
)
async def test_compatibility_results(client, seeded, keyboard_id, product, expected):
    res = await judge(client, keyboard_id, PRODUCT[product])
    assert res.status_code == 200
    assert res.json()["result"] == expected


async def test_compatibility_response_shape(client, seeded):
    body = (await judge(client, KB["Wide7U"], PRODUCT["spacebar"])).json()
    assert set(body) == {"keyboard", "productId", "productName", "checks", "result", "resultLabel", "summary"}
    assert body["keyboard"]["name"] == "Arcade Wide 7U"
    assert body["productId"] == PRODUCT["spacebar"]
    assert body["resultLabel"] == "장착 불가"
    assert [c["key"] for c in body["checks"]] == ["stem", "profile", "spacebar"]
    assert {c["status"] for c in body["checks"]} <= {"compatible", "partial", "incompatible"}


async def test_compatibility_unknown_keyboard_is_404(client, seeded):
    assert (await judge(client, 999999, PRODUCT["cherry"])).status_code == 404


async def test_compatibility_unknown_product_is_404(client, seeded):
    assert (await judge(client, KB["K8"], 999999)).status_code == 404


async def test_compatibility_non_keycap_product_is_400(client, seeded):
    res = await judge(client, KB["K8"], PRODUCT["not_keycap"])
    assert res.status_code == 400
    assert res.json()["detail"] == "키캡 상품만 호환성을 확인할 수 있습니다."


@pytest.mark.parametrize("params", [{"keyboardId": 1}, {"productId": 1}, {}, {"keyboardId": "a", "productId": 1}])
async def test_compatibility_rejects_missing_or_invalid_params(client, seeded, params):
    assert (await client.get("/api/compatibility", params=params)).status_code == 422
