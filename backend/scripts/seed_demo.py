"""시연용 데모 이웃 — 위시맵 WANT 글·교환할 HAVE 글(사이트 상품 연결)로 선물하기·교환 신청을 실제로 해 볼 수 있게
(여러 번 실행해도 같은 결과)

실행 (backend 폴더에서):  python -m scripts.seed_demo
- 이메일은 `demo-<key>@demo.pixelmart.test` — `.test`라 덕력지도·위시맵 집계에서는 빠지고, 화면에는 "데모 이웃"으로 표시
- 닉네임 공개(opt-in)를 켠 상태라 위시맵에서 닉네임으로 찾을 수 있다
- 받은 선물은 개발용 로그인으로 그 이메일에 로그인해 선물함에서 받기·거절할 수 있다
- 덕력지도 캐릭터·이웃 카드도 켜고, 활동 기록(거래·선물 완료)을 넣어 하트 3개를 넘긴 "+N" 이웃도 보이게 한다
"""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal, engine
from app.models import ActivityPoint, Interest, Product, TradePost, User, UserInterest
from app.services.activity import RULES
from app.services.sample_avatars import sample_avatars
from app.services.trade_rules import DEMO_EMAIL_DOMAIN

SEED_FILE = Path(__file__).resolve().parent.parent / "seed" / "demo_users.json"


async def seed_demo(db: AsyncSession) -> str:
    users = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    products = {p.id: p for p in await db.scalars(select(Product))}
    created = {"want": 0, "have": 0}
    for u in users:
        email = f"demo-{u['key']}{DEMO_EMAIL_DOMAIN}"
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, nickname=u["nickname"])
            db.add(user)
        user.region_code = u["regionCode"]
        user.nickname_public = True
        user.profile_public = True
        user.map_avatar_opt_in = True
        user.map_card_public = True
        user.avatar_url = user.avatar_url or sample_avatars(f"demo:{u['key']}", 1)[0]
        await db.flush()
        await _reset_interests_and_activity(db, user.id, u["interestIds"], **u["activity"])
        # 선물·교환으로 닫힌 글은 그대로 두고, 진행 중인 글이 없는 상품만 다시 올린다
        for kind in ("want", "have"):
            open_items = set(
                await db.scalars(
                    select(TradePost.product_id).where(
                        TradePost.user_id == user.id, TradePost.kind == kind, TradePost.status == "open"
                    )
                )
            )
            for product_id, content in u[f"{kind}s"]:
                if product_id in open_items:
                    continue
                db.add(
                    TradePost(
                        user_id=user.id,
                        region_code=u["regionCode"],
                        kind=kind,
                        product_id=product_id,
                        item_name=products[product_id].name,
                        condition="like_new" if kind == "have" else None,
                        trade_method="delivery",
                        content=content,
                    )
                )
                created[kind] += 1
    await db.commit()
    return f"데모 이웃 {len(users)}명, 새 WANT 글 {created['want']}개, 새 HAVE 글 {created['have']}개"


async def _reset_interests_and_activity(
    db: AsyncSession, user_id: int, interest_ids: list[int], trades: int, gifts: int
):
    """취향과 활동 기록을 JSON 그대로 다시 넣는다 — 하루 상한에 걸리지 않게 하루에 한 건씩 과거로 펼친다"""
    await db.execute(delete(UserInterest).where(UserInterest.user_id == user_id))
    # 취향 시드(scripts.seed)에 아직 없는 번호는 건너뛴다
    known = set(await db.scalars(select(Interest.id).where(Interest.id.in_(interest_ids))))
    db.add_all(UserInterest(user_id=user_id, interest_id=i) for i in interest_ids if i in known)
    await db.execute(delete(ActivityPoint).where(ActivityPoint.user_id == user_id))
    history = [("profile", 0), ("first_want", 0)]
    history += [("trade_done", n) for n in range(1, trades + 1)] + [("gift_sent", n) for n in range(1, gifts + 1)]
    now = datetime.now(UTC)
    db.add_all(
        ActivityPoint(
            user_id=user_id, kind=kind, ref_id=ref_id, points=RULES[kind].points, created_at=now - timedelta(days=i + 1)
        )
        for i, (kind, ref_id) in enumerate(reversed(history))
    )
    await db.flush()


async def main() -> None:
    async with SessionLocal() as db:
        summary = await seed_demo(db)
    await engine.dispose()
    print(f"데모 시드 완료: {summary}")


if __name__ == "__main__":
    asyncio.run(main())
