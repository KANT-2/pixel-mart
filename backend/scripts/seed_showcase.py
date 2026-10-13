"""발표 시연용 데이터 — 화면마다 실제로 쓰인 것처럼 보이게 (여러 번 실행해도 같은 결과)

실행 (backend 폴더에서, seed → seed_demo 다음):  python -m scripts.seed_showcase 발표계정@이메일
- 데모 이웃: 지난 3주 배송 완료 주문, 상품 리뷰, 상품 문의와 답변, 찜 (리뷰·순위·뱃지·인기순이 채워진다)
- 발표 계정(한 번 로그인한 계정): 지역·취향·지도 공개, 활동 기록(하트·뱃지) — 아바타는 그대로(메인 배너용),
  WANT·HAVE 글 3개, 같은 동네 이웃이 보낸 선물·교환 신청(대기)·교환 진행 중(이웃은 받았어요) — 알림 포함.
  시연에서 선물 받기, 교환 수락, '받았어요'로 교환 완료까지 눌러 볼 수 있다
"""

import asyncio
import random
import sys
from datetime import UTC, datetime, timedelta

from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionLocal, engine
from app.models import (
    ActivityPoint,
    Gift,
    Notification,
    Order,
    OrderItem,
    OrderStatusHistory,
    Product,
    ProductQuestion,
    Review,
    TradePost,
    TradeRequest,
    User,
    UserInterest,
    Wishlist,
)
from app.services.orders import DELIVERY_FLOW
from app.services.sample_avatars import sample_avatars
from app.services.trade_rules import DEMO_EMAIL_DOMAIN
from scripts.seed_demo import seed_demo

# 시연에서 자주 보여 줄 상품 (메인 추천·키캡·무드등) — 리뷰·문의를 먼저 채운다
FEATURED = [1, 2, 3, 4, 5, 8, 9, 10, 11, 13, 15, 19, 21, 22]
REVIEWERS_PER_FEATURED = 3
# 발표 계정에 쓰는 활동 기록 번호 (실제 글 번호와 겹치지 않게 큰 수)
SHOWCASE_REF = 900_000

REVIEWS: dict[str, list[tuple[int, str]]] = {
    "keycap": [
        (5, "체리 프로파일 키보드에 딱 맞게 들어가요. 불 켜면 하트가 더 선명해져서 볼 때마다 기분 좋아요."),
        (5, "레진 마감이 깔끔하고 기포가 거의 없어요. ESC 자리에 꽂아 두니 책상 분위기가 확 살아요."),
        (4, "색감은 사진이랑 거의 같아요. 키감이 살짝 높아서 처음엔 어색했는데 금방 적응했어요."),
        (5, "선물용으로 하나 더 샀어요. 포장도 꼼꼼해서 받는 사람이 좋아했어요."),
    ],
    "deskmat": [
        (5, "마우스가 부드럽게 잘 미끄러지고 바닥 고무가 단단해서 밀리지 않아요."),
        (4, "도트 그림이 생각보다 크고 선명해요. 처음에 살짝 말려 있었는데 하루 펴 두니 괜찮아졌어요."),
        (5, "책상 전체를 덮는 크기라 키보드랑 마우스를 다 올려도 넉넉해요. 방수도 잘 돼요."),
    ],
    "desk": [
        (5, "밤에 은은하게 켜 두기 좋아요. USB-C라서 모니터 뒤에 꽂아 쓰고 있어요."),
        (4, "밝기는 무드등 정도라 조명 대신은 어렵지만 분위기 내기에는 최고예요."),
        (5, "책상 위 작은 소품 정리용으로 샀는데 디자인이 귀여워서 자꾸 열어 보게 돼요."),
    ],
    "goods": [
        (5, "아크릴이 두껍고 인쇄가 양면이라 가방에 달아도 예뻐요."),
        (4, "생각보다 조금 작지만 디테일이 살아 있어요. 다른 캐릭터도 모으고 싶어요."),
        (5, "친구랑 커플로 맞췄어요. 도트 표정이 너무 귀여워요."),
    ],
    "living": [
        (5, "집에서도 게임 무드를 낼 수 있어서 만족해요. 마감도 깔끔해요."),
        (4, "사진보다 색이 조금 진한 편인데 오히려 더 레트로해 보여서 좋아요."),
    ],
    "tech": [
        (5, "케이블 정리가 확실히 편해졌어요. 픽셀 디자인이라 책상에 두기도 예뻐요."),
        (4, "기능은 무난하고 디자인이 마음에 들어요. 배송도 빨랐어요."),
    ],
}

QUESTIONS: list[tuple[int, str, str, str]] = [
    (
        1,
        "키보드 호환 문의",
        "체리 MX 스위치 텍스 키보드에도 맞을까요?",
        "네, 체리 MX 호환 스위치라면 모두 사용하실 수 있어요.",
    ),
    (
        1,
        "재입고 일정",
        "빨간 하트 말고 파란 하트도 나올 예정인가요?",
        "다음 달에 블루·골드 하트 2종이 출시될 예정이에요.",
    ),
    (3, "사이즈 문의", "900×400 사이즈도 있나요?", "현재는 800×300 한 가지예요. 큰 사이즈는 검토 중이에요."),
    (8, "전원 문의", "보조배터리로도 켜지나요?", "USB-C 5V 전원이면 보조배터리로도 켜져요."),
    (8, "밝기 조절", "밝기 조절이 되나요?", "터치로 3단계 밝기 조절이 가능해요."),
    (9, "선물 포장", "선물 포장도 가능할까요?", "주문 메모에 남겨 주시면 픽셀 포장지로 감싸 드려요."),
    (5, "고리 색상", "키링 고리는 은색인가요?", "은색 니켈 고리로 나가요."),
]

# 발표 계정이 올리는 글 (이름으로 찾아 한 번만 만든다)
MY_WANT = (8, "책상 모니터 옆에 둘 인베이더 무드등 찾고 있어요")
# 첫 글은 이웃의 교환 신청(대기), 둘째 글은 교환 진행 중, 셋째 글은 게시판에서 직접 교환 신청할 때 고를 물건
MY_HAVES = [
    (1, "HP 하트 키캡 하나 남아요. 미개봉이라 교환 원해요"),
    (5, "슬라임 아크릴 키링 중복이에요. 다른 굿즈랑 바꿔요"),
    (6, "픽셀 스티커 팩 한 세트 남아요"),
]
# 이웃(레트로토끼)이 교환 진행 중인 건에 걸어 둘 물건
NEIGHBOR_HAVE = (2, "코인 키캡 세트 하나 남아서 교환해요")

# 발표 계정과 같은 동네(홍대·합정)에 사는 이웃과 그 거래글 — 게시판·지도가 비어 보이지 않게
# (키, 닉네임, [(종류, 상품, 내용, 상태, 가격)])
LOCAL_NEIGHBORS: list[tuple[str, str, list[tuple[str, int, str, str | None, int | None]]]] = [
    (
        "retrobunny",
        "레트로토끼",
        [
            ("have", 7, "보물상자 소품함 하나 더 생겼어요. 키캡이랑 바꿔요", "like_new", None),
            ("have", 12, "슬라임 미니 아크릴 키링 중복이에요", "new", None),
        ],
    ),
    (
        "hongdae",
        "홍대도트러",
        [
            ("have", 9, "슬라임 아티산 키캡 하나 남아요. 다른 아티산이랑 교환 원해요", "like_new", None),
            ("have", 4, "인베이더 장패드 새 거 그대로 있어요", "new", None),
            ("sell", 10, "슬라임 장패드 한 달 썼어요. 상태 좋아요", "used", 9000),
            ("want", 1, "HP 하트 키캡 구해요. 교환도 좋아요", None, None),
        ],
    ),
    (
        "mangwon",
        "망원픽셀",
        [
            ("have", 11, "슬라임 미니 무드등 선물 받았는데 하나 더 있어요", "new", None),
            ("have", 3, "던전 맵 장패드 포장만 뜯었어요", "like_new", None),
            ("sell", 6, "픽셀 스티커 팩 2세트 판매해요", "new", 3500),
        ],
    ),
]


async def _clean(db: AsyncSession, demo_ids: list[int], me: User) -> None:
    """이전에 넣은 시연 데이터를 지운다 (데모 이웃이 만든 것만 + 발표 계정의 시연용 기록)"""
    old = list(await db.scalars(select(TradeRequest).where(TradeRequest.requester_id.in_(demo_ids))))
    old_requests = [r.id for r in old]
    # 수락으로 마감된 글은 다시 진행 중으로 (데모 이웃 글과 발표 계정 글만)
    for r in old:
        for post in (r.post, r.offer_post):
            if post is not None and post.user_id in (*demo_ids, me.id) and post.status == "done":
                post.status = "open"
    old_gifts = list(await db.scalars(select(Gift.id).where(Gift.sender_id.in_(demo_ids), Gift.recipient_id == me.id)))
    keys = [Notification.ref_key.like(f"tr:{i}%") for i in old_requests] + [
        Notification.ref_key.like(f"gift:{i}%") for i in old_gifts
    ]
    if keys:
        await db.execute(delete(Notification).where(Notification.user_id.in_((*demo_ids, me.id)), or_(*keys)))
    await db.execute(delete(TradeRequest).where(TradeRequest.requester_id.in_(demo_ids)))
    await db.execute(delete(Gift).where(Gift.sender_id.in_(demo_ids), Gift.recipient_id == me.id))
    await db.execute(delete(Order).where(Order.user_id.in_(demo_ids)))  # 품목·이력·리뷰는 함께 지워진다
    await db.execute(delete(ProductQuestion).where(ProductQuestion.user_id.in_(demo_ids)))
    await db.execute(delete(Wishlist).where(Wishlist.user_id.in_(demo_ids)))
    await db.execute(delete(ActivityPoint).where(ActivityPoint.user_id == me.id, ActivityPoint.ref_id >= SHOWCASE_REF))
    await db.flush()
    await _drop_orphan_notices(db, me)


async def _drop_orphan_notices(db: AsyncSession, me: User) -> None:
    """가리키는 교환 신청·선물이 없어진 알림은 지운다 (테스트가 데모 이웃을 지우면 알림만 남아 중복처럼 보인다)"""
    notices = (
        await db.execute(
            select(Notification.id, Notification.ref_key).where(
                Notification.user_id == me.id,
                or_(Notification.ref_key.like("tr:%"), Notification.ref_key.like("gift:%")),
            )
        )
    ).all()
    live = {
        "tr": set(await db.scalars(select(TradeRequest.id))),
        "gift": set(await db.scalars(select(Gift.id))),
    }
    orphans = [nid for nid, key in notices if int(key.split(":")[1]) not in live[key.split(":")[0]]]
    if orphans:
        await db.execute(delete(Notification).where(Notification.id.in_(orphans)))
    await db.flush()


async def _local_neighbors(db: AsyncSession, me: User) -> int:
    """같은 동네 이웃(데모 계정)과 거래글 — 이미 있으면 진행 중으로 되돌리기만"""
    count = 0
    for n, (key, nickname, posts) in enumerate(LOCAL_NEIGHBORS):
        email = f"demo-{key}{DEMO_EMAIL_DOMAIN}"
        user = await db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(email=email, nickname=nickname)
            db.add(user)
        user.region_code = me.region_code
        user.nickname_public = user.profile_public = user.map_avatar_opt_in = user.map_card_public = True
        user.avatar_url = user.avatar_url or sample_avatars(f"showcase-neighbor:{n}", 1)[0]
        await db.flush()
        for kind, product_id, content, condition, price in posts:
            await _post(db, user, kind, product_id, content, condition, price)
            count += 1
    await _hide_duplicates(db)
    return count


async def _hide_duplicates(db: AsyncSession) -> None:
    """데모 이웃의 같은 내용 진행 중 글은 가장 최근 것만 남긴다 (seed_demo가 새로 올린 글과 다시 연 글이 겹치지 않게)"""
    posts = (
        await db.scalars(
            select(TradePost)
            .join(User, User.id == TradePost.user_id)
            .where(User.email.like(f"%{DEMO_EMAIL_DOMAIN}"), TradePost.status == "open")
            .order_by(TradePost.id.desc())
        )
    ).all()
    seen: set[tuple[int, str, str]] = set()
    for post in posts:
        key = (post.user_id, post.kind, post.content)
        if key in seen:
            post.status = "hidden"
        seen.add(key)
    await db.flush()


def _last_monday(now: datetime) -> datetime:
    kst = now.astimezone(UTC) + timedelta(hours=9)
    monday = (kst - timedelta(days=kst.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return monday - timedelta(hours=9)  # UTC


async def _orders_and_reviews(db: AsyncSession, demo: list[User], products: dict[int, Product]) -> tuple[int, int]:
    """데모 이웃마다 지난 3주 배송 완료 주문 2~4건 — 자주 보여 줄 상품은 이웃 3명이 사서 리뷰를 꼭 남긴다"""
    rng = random.Random("showcase-orders")
    now = datetime.now(UTC)
    last_week = _last_monday(now) - timedelta(days=7)
    others = [pid for pid in products if pid not in FEATURED]
    bought: dict[int, list[int]] = {u.id: [] for u in demo}
    for i, pid in enumerate(FEATURED):
        for k in range(REVIEWERS_PER_FEATURED):
            bought[demo[(i + k * 3) % len(demo)].id].append(pid)
    for user in demo:
        bought[user.id] += rng.sample(others, rng.randint(1, 3))
        rng.shuffle(bought[user.id])
    order_count = review_count = 0
    templates = {k: rng.sample(v, len(v)) for k, v in REVIEWS.items()}
    for index, user in enumerate(demo):
        picks = bought[user.id]
        chunks = max(2, min(4, len(picks) // 2))
        for n in range(chunks):
            part = picks[n::chunks]
            if not part:
                continue
            # 첫 주문은 지난주(동네 큰손 계산 기간), 나머지는 그 전 2주에 흩어 둔다
            placed = (
                last_week + timedelta(days=rng.randint(0, 6), hours=rng.randint(9, 22))
                if n == 0
                else now - timedelta(days=rng.randint(8, 21), hours=rng.randint(0, 12))
            )
            items = [
                OrderItem(product_id=pid, quantity=rng.choice((1, 1, 1, 2)), unit_price=products[pid].price)
                for pid in part
            ]
            order = Order(
                user_id=user.id,
                status="delivered",
                total_price=sum(i.unit_price * i.quantity for i in items),
                recipient_name=user.nickname,
                address="서울특별시 마포구 월드컵북로 00",
                created_at=placed,
                items=items,
            )
            db.add(order)
            await db.flush()
            for step, status in enumerate(DELIVERY_FLOW):
                db.add(OrderStatusHistory(order_id=order.id, status=status, changed_at=placed + timedelta(days=step)))
            order_count += 1
            for item in items:
                if item.product_id not in FEATURED and rng.random() < 0.5:
                    continue
                bank = templates.get(products[item.product_id].category_slug) or templates["goods"]
                rating, content = bank[(index + item.product_id) % len(bank)]
                db.add(
                    Review(
                        user_id=user.id,
                        product_id=item.product_id,
                        order_item_id=item.id,
                        rating=rating,
                        content=content,
                        created_at=placed + timedelta(days=rng.randint(4, 6)),
                    )
                )
                review_count += 1
    await db.flush()
    return order_count, review_count


async def _questions_and_wishes(db: AsyncSession, demo: list[User]) -> None:
    rng = random.Random("showcase-qa")
    now = datetime.now(UTC)
    for n, (product_id, title, content, answer) in enumerate(QUESTIONS):
        asked = now - timedelta(days=rng.randint(2, 18), hours=rng.randint(0, 20))
        db.add(
            ProductQuestion(
                product_id=product_id,
                user_id=demo[n % len(demo)].id,
                title=title,
                content=content,
                answer=answer,
                answered_at=asked + timedelta(hours=rng.randint(2, 20)),
                created_at=asked,
            )
        )
    for user in demo:
        for product_id in rng.sample(FEATURED, rng.randint(3, 6)):
            db.add(Wishlist(user_id=user.id, product_id=product_id))
    await db.flush()


async def _presenter(db: AsyncSession, me: User) -> tuple[TradePost, list[TradePost]]:
    """발표 계정 — 지역·취향·공개 설정·활동 기록·WANT/HAVE 글 (아바타가 있으면 메인 배너가 개인화돼서 그대로 둔다)"""
    me.region_code = me.region_code or "11440-01"
    me.map_avatar_opt_in = me.map_card_public = me.nickname_public = me.profile_public = True
    me.fandom_opt_in = True
    if not await db.scalar(select(UserInterest.user_id).where(UserInterest.user_id == me.id).limit(1)):
        db.add_all(UserInterest(user_id=me.id, interest_id=i) for i in (1, 52, 28))

    # 프로필 +5 · 첫 WANT +10 · 거래 6번 +120 · 선물 3번 +30 = 165점 → 하트 5개 · LV.3 · 교환 5회+
    now = datetime.now(UTC)
    history = [("profile", 0), ("first_want", 0)]
    history += [("trade_done", SHOWCASE_REF + n) for n in range(6)] + [
        ("gift_sent", SHOWCASE_REF + n) for n in range(3)
    ]
    for day, (kind, ref_id) in enumerate(history):
        exists = await db.scalar(
            select(ActivityPoint.id).where(
                ActivityPoint.user_id == me.id, ActivityPoint.kind == kind, ActivityPoint.ref_id == ref_id
            )
        )
        if exists is None:
            points = {"profile": 5, "first_want": 10, "trade_done": 20, "gift_sent": 10}[kind]
            db.add(
                ActivityPoint(
                    user_id=me.id, kind=kind, ref_id=ref_id, points=points, created_at=now - timedelta(days=20 - day)
                )
            )

    want = await _post(db, me, "want", *MY_WANT, None)
    haves = [await _post(db, me, "have", pid, content, "new") for pid, content in MY_HAVES]
    await db.flush()
    return want, haves


async def _post(
    db: AsyncSession,
    owner: User,
    kind: str,
    product_id: int,
    content: str,
    condition: str | None,
    price: int | None = None,
) -> TradePost:
    """글 내용으로 찾아 한 번만 만들고, 다시 실행하면 진행 중으로 되돌린다"""
    product = await db.get(Product, product_id)
    found = await db.scalar(
        select(TradePost).where(TradePost.user_id == owner.id, TradePost.kind == kind, TradePost.content == content)
    )
    if found is None:
        found = TradePost(
            user_id=owner.id,
            region_code=owner.region_code,
            kind=kind,
            product_id=product_id,
            item_name=product.name,
            condition=condition,
            price=price,
            trade_method="direct" if kind == "have" else "both" if kind == "sell" else "delivery",
            content=content,
        )
        db.add(found)
    found.status = "open"
    await db.flush()
    return found


async def _neighbor_actions(me: User, want_id: int, have_ids: list[int], neighbor_have_id: int) -> list[str]:
    """같은 동네 데모 이웃이 실제 API로 선물·교환 신청 — 알림까지 함께 생긴다"""
    done = []
    transport = ASGITransport(app=__import__("app.main", fromlist=["app"]).app)
    async with (
        AsyncClient(transport=transport, base_url="http://showcase") as neighbor,
        AsyncClient(transport=transport, base_url="http://showcase") as owner,
    ):
        await neighbor.post(
            "/api/auth/dev-login", json={"email": f"demo-retrobunny{DEMO_EMAIL_DOMAIN}", "nickname": "레트로토끼"}
        )
        await owner.post("/api/auth/dev-login", json={"email": me.email})
        res = await neighbor.post(
            "/api/gifts",
            json={
                "tradePostId": want_id,
                "productId": MY_WANT[0],
                "message": "같은 동네 이웃 선물이에요! 책상에 잘 어울릴 거예요",
            },
        )
        done.append(f"선물 {res.status_code}")

        # 교환 신청 (대기) — 이웃의 원래 교환글 물건으로
        offers = (await neighbor.get("/api/local/trades/mine")).json()
        first = next(
            p["id"] for p in offers if p["kind"] == "have" and p["status"] == "open" and p["id"] != neighbor_have_id
        )
        res = await neighbor.post("/api/local/trade-requests", json={"postId": have_ids[0], "offerPostId": first})
        done.append(f"교환 신청 {res.status_code}")

        # 교환 진행 중 — 내가 수락했고 이웃은 이미 받았어요 (시연에서 내가 누르면 완료)
        req = await neighbor.post(
            "/api/local/trade-requests", json={"postId": have_ids[1], "offerPostId": neighbor_have_id}
        )
        request_id = req.json()["id"]
        accepted = await owner.post(f"/api/local/trade-requests/{request_id}/accept")
        received = await neighbor.post(f"/api/local/trade-requests/{request_id}/received")
        done.append(f"교환 진행 {req.status_code}/{accepted.status_code}/{received.status_code}")
    return done


async def seed_showcase(email: str) -> str:
    async with SessionLocal() as db:
        await seed_demo(db)
    async with SessionLocal() as db:
        me = await db.scalar(select(User).where(User.email == email))
        if me is None:
            raise SystemExit(f"{email} 계정이 없어요. 사이트에서 한 번 로그인한 뒤 다시 실행하세요.")
        demo = list(await db.scalars(select(User).where(User.email.like(f"%{DEMO_EMAIL_DOMAIN}")).order_by(User.id)))
        products = {p.id: p for p in await db.scalars(select(Product))}
        await _clean(db, [u.id for u in demo], me)
        orders, reviews = await _orders_and_reviews(db, demo, products)
        await _questions_and_wishes(db, demo)
        want, haves = await _presenter(db, me)
        neighbor = next(u for u in demo if u.email == f"demo-retrobunny{DEMO_EMAIL_DOMAIN}")
        neighbor_have = await _post(db, neighbor, "have", *NEIGHBOR_HAVE, "like_new")
        local_posts = await _local_neighbors(db, me)
        await db.commit()
        ids = (want.id, [h.id for h in haves], neighbor_have.id)
    actions = await _neighbor_actions(me, *ids)
    actions.append(f"동네 이웃 글 {local_posts}개")
    async with SessionLocal() as db:
        await _drop_orphan_notices(db, await db.get(User, me.id))
        await db.commit()
    done = ", ".join(actions)
    return f"데모 이웃 {len(demo)}명 · 주문 {orders}건 · 리뷰 {reviews}개 · 문의 {len(QUESTIONS)}개 · {email} ({done})"


async def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("사용법: python -m scripts.seed_showcase 발표계정@이메일")
    summary = await seed_showcase(sys.argv[1])
    await engine.dispose()
    print(f"시연 데이터 완료: {summary}")


if __name__ == "__main__":
    asyncio.run(main())
