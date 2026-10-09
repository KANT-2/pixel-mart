"""PIXEL LOCAL 시드 — 지역(시 › 구 › 동·생활권)·취향 태그. scripts/seed.py에서 함께 실행된다"""

import json
from pathlib import Path

from sqlalchemy import delete, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import FandomSample, Interest, Region, TradePost, User, WishSample

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"
# 샘플 거래글 작성자 — 집계 참여(fandom_opt_in)를 켜지 않아 덕력지도·Wish Map 숫자에는 들어가지 않는다
SAMPLE_EMAIL = "sample@pixelmart.local"


def load(name: str) -> list[dict]:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def seed_local(db: AsyncSession) -> str:
    regions = load("regions.json")
    interests = load("interests.json")
    samples = load("fandom_samples.json")
    trade_samples = load("trade_samples.json")
    wish_samples = load("wish_samples.json")

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

    await db.execute(delete(WishSample))
    await db.execute(
        insert(WishSample),
        [{"region_code": x["regionCode"], "product_id": x["productId"], "count": x["count"]} for x in wish_samples],
    )

    # 샘플 거래·교환 글 (응답에 isSample) — 샘플 작성자의 글을 매번 새로 넣는다
    author = await db.scalar(select(User).where(User.email == SAMPLE_EMAIL))
    if author is None:
        author = User(email=SAMPLE_EMAIL, nickname="[샘플] PIXEL LOCAL")
        db.add(author)
        await db.flush()
    await db.execute(delete(TradePost).where(TradePost.user_id == author.id))
    for t in trade_samples:
        db.add(
            TradePost(
                user_id=author.id,
                region_code=t["regionCode"],
                kind=t["kind"],
                item_name=t["itemName"],
                product_id=t.get("productId"),
                interest_id=t.get("interestId"),
                condition=t.get("condition"),
                price=t.get("price"),
                trade_method=t["tradeMethod"],
                content=t["content"],
                is_sample=True,
            )
        )
    return (
        f"지역 {len(regions)}개, 취향 {len(interests)}개, 덕력지도 샘플 {len(samples)}칸, "
        f"샘플 거래글 {len(trade_samples)}개, Wish Map 샘플 {len(wish_samples)}칸"
    )
