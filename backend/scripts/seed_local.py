"""PIXEL LOCAL 시드 — 지역(시 › 구 › 동·생활권)·취향 태그. scripts/seed.py에서 함께 실행된다"""

import json
from pathlib import Path

from sqlalchemy import delete, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FandomSample, Interest, Region

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


def load(name: str) -> list[dict]:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def seed_local(db: AsyncSession) -> str:
    regions = load("regions.json")
    interests = load("interests.json")
    samples = load("fandom_samples.json")

    # 부모가 먼저 들어가도록 시 → 구 → 생활권 순서 (JSON도 그 순서로 작성)
    for r in sorted(regions, key=lambda x: ["sido", "sigungu", "zone"].index(x["level"])):
        values = {"code": r["code"], "level": r["level"], "parent_code": r["parentCode"], "name": r["name"]}
        stmt = insert(Region).values(**values)
        await db.execute(stmt.on_conflict_do_update(index_elements=[Region.code], set_=values))

    for i in sorted(interests, key=lambda x: x["id"]):
        values = {"id": i["id"], "type": i["type"], "name": i["name"], "parent_id": i["parentId"]}
        stmt = insert(Interest).values(**values)
        await db.execute(stmt.on_conflict_do_update(index_elements=[Interest.id], set_=values))
    await db.execute(text("SELECT setval(pg_get_serial_sequence('interests', 'id'), (SELECT MAX(id) FROM interests))"))

    # Cold Start Mock 집계 (응답에 isSample) — JSON에서 뺀 값은 지워지도록 전체 교체
    await db.execute(delete(FandomSample))
    await db.execute(
        insert(FandomSample),
        [{"region_code": x["regionCode"], "interest_id": x["interestId"], "count": x["count"]} for x in samples],
    )
    return f"지역 {len(regions)}개, 취향 {len(interests)}개, 덕력지도 샘플 {len(samples)}칸"
