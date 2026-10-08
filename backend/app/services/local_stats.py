"""PIXEL LOCAL 익명 집계 규칙 (덕력지도 운영정책 5·11·15장) — 개인이 아니라 집단을 보여 준다"""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Literal

from app.services.regions import RegionTree

# 5명 미만은 정확한 숫자를 보여 주지 않는다 (순위도 이 기준을 넘은 항목만)
MIN_GROUP_SIZE = 5
# 테스트 계정(예약 도메인 .test — dev-login 기본 이메일)은 집계에서 뺀다
EXCLUDED_EMAIL_SUFFIX = ".test"

Period = Literal["30d", "90d", "all"]
PERIOD_DAYS = {"30d": 30, "90d": 90}


def period_start(period: Period, now: datetime | None = None) -> datetime | None:
    if period == "all":
        return None
    return (now or datetime.now(UTC)) - timedelta(days=PERIOD_DAYS[period])


def rollup(tree: RegionTree, counts: dict[tuple[str, int], int]) -> dict[tuple[str, int], int]:
    """하위 지역 인원을 상위 지역에 합산 (판교 → 분당구 → 성남시).

    입력은 사용자 한 명이 한 지역에만 속한 (지역, 취향)별 사용자 수라, 더해도 같은 사람이 두 번 세어지지 않는다.
    """
    total: dict[tuple[str, int], int] = defaultdict(int)
    for (region, key), n in counts.items():
        for ancestor in tree.ancestors(region):
            total[(ancestor, key)] += n
    return dict(total)


def present(count: int) -> tuple[int | None, bool]:
    """(보여 줄 숫자, 기준 미만 여부) — 기준 미만이면 숫자를 숨긴다"""
    return (count, False) if count >= MIN_GROUP_SIZE else (None, True)
