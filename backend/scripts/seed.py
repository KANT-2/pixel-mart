"""상품·카테고리 시드 데이터 넣기 (여러 번 실행해도 같은 결과)

실행 (backend 폴더에서):  python -m scripts.seed
데이터 원본은 프론트의 data/*.ts → `node backend/scripts/export_seed.mjs` 로 backend/seed/*.json 갱신
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

from app.core.db import SessionLocal, engine
from app.models import Category, Faq, Keyboard, KeycapSpec, Product
from scripts.seed_local import seed_local

SEED_DIR = Path(__file__).resolve().parent.parent / "seed"


def load(name: str) -> list[dict]:
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


async def main() -> None:
    categories = load("categories.json")
    products = load("products.json")
    faqs = load("faqs.json")
    keyboards = load("keyboards.json")
    keycap_specs = load("keycap_specs.json")
    slug_by_name = {c["name"]: c["slug"] for c in categories}

    async with SessionLocal() as db:
        for order, c in enumerate(categories):
            values = {"slug": c["slug"], "name": c["name"], "description": c["description"], "sort_order": order}
            stmt = insert(Category).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Category.slug], set_=values))

        for p in products:
            values = {
                "id": p["id"],
                "name": p["name"],
                "price": p["price"],
                "category_slug": slug_by_name[p["category"]],
                "image_url": p["imageUrl"],
                "description": p["description"],
                "is_new": p.get("isNew", False),
            }
            stmt = insert(Product).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Product.id], set_=values))

        # id를 직접 넣었으므로 다음 자동 번호를 최대값 뒤로 맞춤
        await db.execute(
            text("SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products))")
        )
        for order, f in enumerate(faqs):
            values = {**f, "sort_order": order}
            stmt = insert(Faq).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Faq.id], set_=values))
        await db.execute(text("SELECT setval(pg_get_serial_sequence('faqs', 'id'), (SELECT MAX(id) FROM faqs))"))
        # 키캡 호환성: Mock 키보드와 키캡 상품의 규격 (상품이 먼저 들어간 뒤에 넣는다)
        for k in keyboards:
            values = {
                "id": k["id"],
                "maker": k["maker"],
                "model": k["model"],
                "layout": k["layout"],
                "stem": k["stem"],
                "profile_support": k["profileSupport"],
                "esc_size": k["escSize"],
                "spacebar_size": k["spacebarSize"],
                "has_arrow_cluster": k["hasArrowCluster"],
            }
            stmt = insert(Keyboard).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[Keyboard.id], set_=values))
        await db.execute(
            text("SELECT setval(pg_get_serial_sequence('keyboards', 'id'), (SELECT MAX(id) FROM keyboards))")
        )
        for s in keycap_specs:
            values = {
                "product_id": s["productId"],
                "profile": s["profile"],
                "stem": s["stem"],
                "key_sizes": s["keySizes"],
            }
            stmt = insert(KeycapSpec).values(**values)
            await db.execute(stmt.on_conflict_do_update(index_elements=[KeycapSpec.product_id], set_=values))
        local_summary = await seed_local(db)
        await db.commit()

    await engine.dispose()
    print(
        f"시드 완료: 카테고리 {len(categories)}개, 상품 {len(products)}개, FAQ {len(faqs)}개, "
        f"키보드 {len(keyboards)}개, 키캡 규격 {len(keycap_specs)}개, {local_summary}"
    )


if __name__ == "__main__":
    asyncio.run(main())
