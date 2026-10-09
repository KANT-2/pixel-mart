"""시연용 데모 이웃 — 위시맵 WANT 글(사이트 상품 연결)과 선물하기를 실제로 해 볼 수 있게 (여러 번 실행해도 같은 결과)

실행 (backend 폴더에서):  python -m scripts.seed_demo
- 이메일은 `demo-<key>@demo.pixelmart.test` — `.test`라 덕력지도·위시맵 집계에서는 빠지고, 화면에는 "데모 이웃"으로 표시
- 닉네임 공개(opt-in)를 켠 상태라 위시맵에서 닉네임으로 찾을 수 있다
- 받은 선물은 개발용 로그인으로 그 이메일에 로그인해 선물함에서 받기·거절할 수 있다
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal, engine
from app.models import Product, TradePost, User
from app.services.trade_rules import DEMO_EMAIL_DOMAIN

SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "demo_users.json"


async def seed_demo(db: AsyncSession) -> str:
    users = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    products = {p.id: p for p in await db.scalars(select(Product))}
    created = 0
    for u in users:
        email = f"demo-{u['key']}{DEMO_EMAIL_DOMAIN}"
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, nickname=u["nickname"])
            db.add(user)
        user.region_code = u["regionCode"]
        user.nickname_public = True
        await db.flush()
        open_items = set(
            await db.scalars(
                select(TradePost.product_id).where(
                    TradePost.user_id == user.id, TradePost.kind == "want", TradePost.status == "open"
                )
            )
        )
        # 선물로 닫힌 글은 그대로 두고, 진행 중인 글이 없는 상품만 다시 올린다
        for product_id, content in u["wants"]:
            if product_id in open_items:
                continue
            db.add(
                TradePost(
                    user_id=user.id,
                    region_code=u["regionCode"],
                    kind="want",
                    product_id=product_id,
                    item_name=products[product_id].name,
                    trade_method="delivery",
                    content=content,
                )
            )
            created += 1
    await db.commit()
    return f"데모 이웃 {len(users)}명, 새 WANT 글 {created}개"


async def main() -> None:
    async with SessionLocal() as db:
        summary = await seed_demo(db)
    await engine.dispose()
    print(f"데모 시드 완료: {summary}")


if __name__ == "__main__":
    asyncio.run(main())
