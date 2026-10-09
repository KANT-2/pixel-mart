"""PIXEL LOCAL ③ 거래·HAVE/WANT 교환 · 매칭 · Wish Map (이번 범위는 Prototype/Mock)"""

from math import ceil
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.deps import CurrentUser, DbSession, OptionalUser
from app.models import Interest, Product, TradePost, User, Wishlist, WishSample
from app.schemas.common import Page
from app.schemas.local import (
    InterestOut,
    TradeAuthorOut,
    TradeMatchOut,
    TradePostIn,
    TradePostOut,
    TradeStatusIn,
    WishMapOut,
    WishWantsOut,
)
from app.schemas.product import ProductOut
from app.services import local_stats
from app.services.local_stats import MIN_GROUP_SIZE, rollup
from app.services.regions import RegionTree, load_tree
from app.services.trade_rules import DEMO_EMAIL_DOMAIN, contains_private_info, normalize, same_item

router = APIRouter(prefix="/local", tags=["local"])


def post_out(post: TradePost, tree: RegionTree, viewer_id: int | None) -> TradePostOut:
    return TradePostOut(
        id=post.id,
        kind=post.kind,
        status=post.status,
        item_name=post.item_name,
        condition=post.condition,
        price=post.price,
        trade_method=post.trade_method,
        content=post.content,
        product=ProductOut.from_model(post.product) if post.product else None,
        interest=InterestOut.model_validate(post.interest) if post.interest else None,
        region_code=post.region_code,
        region_name=tree.full_name(post.region_code),
        is_mine=post.user_id == viewer_id,
        is_sample=post.is_sample,
        is_demo=post.author.email.endswith(DEMO_EMAIL_DOMAIN),
        created_at=post.created_at,
        author=author_out(post),
    )


def author_out(post: TradePost) -> TradeAuthorOut | None:
    """위시맵 닉네임 공개에 동의한 사람의 WANT 글만 작성자를 보여 준다 (샘플 글은 항상 익명)"""
    if post.kind != "want" or post.is_sample or not post.author.nickname_public:
        return None
    return TradeAuthorOut(nickname=post.author.nickname, avatar_url=post.author.avatar_url)


def like_pattern(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def subtree(tree: RegionTree, code: str) -> list[str]:
    return [c for c in tree.by_code if code in tree.ancestors(c)]


@router.get("/trades", response_model=Page[TradePostOut], summary="지역 거래·교환 글 (진행 중, 최신순, 하위 지역 포함)")
async def list_trades(
    db: DbSession,
    viewer: OptionalUser,
    region: Annotated[str | None, Query(max_length=12)] = None,
    kind: Literal["have", "want", "sell"] | None = None,
    product_id: Annotated[int | None, Query(alias="productId")] = None,
    interest_id: Annotated[int | None, Query(alias="interestId")] = None,
    q: Annotated[
        str | None,
        Query(
            min_length=1, max_length=40, description="물건 이름·연결 상품 이름·설명 일부 (사거나 팔고 싶은 물건 찾기)"
        ),
    ] = None,
    nickname: Annotated[
        str | None,
        Query(min_length=1, max_length=30, description="닉네임 일부 — 닉네임 공개에 동의한 사람의 WANT 글만"),
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=60)] = 12,
):
    tree = await load_tree(db)
    filters = [TradePost.status == "open"]
    if region is not None:
        if region not in tree.by_code:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 지역입니다.")
        filters.append(TradePost.region_code.in_(subtree(tree, region)))
    if kind is not None:
        filters.append(TradePost.kind == kind)
    if product_id is not None:
        filters.append(TradePost.product_id == product_id)
    if interest_id is not None:
        filters.append(TradePost.interest_id == interest_id)
    if q is not None and q.strip():
        pattern = like_pattern(q.strip())
        product_ids = select(Product.id).where(Product.name.ilike(pattern, escape="\\"))
        filters.append(
            or_(
                TradePost.item_name.ilike(pattern, escape="\\"),
                TradePost.content.ilike(pattern, escape="\\"),
                TradePost.product_id.in_(product_ids),
            )
        )
    if nickname is not None and nickname.strip():
        author_ids = select(User.id).where(
            User.nickname_public.is_(True), User.nickname.ilike(like_pattern(nickname.strip()), escape="\\")
        )
        filters += [TradePost.kind == "want", TradePost.is_sample.is_(False), TradePost.user_id.in_(author_ids)]

    total = await db.scalar(select(func.count()).select_from(TradePost).where(*filters)) or 0
    posts = await db.scalars(
        select(TradePost)
        .where(*filters)
        .order_by(TradePost.created_at.desc(), TradePost.id.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    viewer_id = viewer.id if viewer else None
    return Page[TradePostOut](
        items=[post_out(p, tree, viewer_id) for p in posts],
        total=total,
        page=page,
        size=size,
        total_pages=max(1, ceil(total / size)),
    )


@router.get("/trades/mine", response_model=list[TradePostOut], summary="내 거래·교환 글 (완료·숨김 포함)")
async def my_trades(user: CurrentUser, db: DbSession):
    tree = await load_tree(db)
    posts = await db.scalars(
        select(TradePost).where(TradePost.user_id == user.id).order_by(TradePost.created_at.desc(), TradePost.id.desc())
    )
    return [post_out(p, tree, user.id) for p in posts]


@router.post(
    "/trades",
    response_model=TradePostOut,
    status_code=status.HTTP_201_CREATED,
    summary="거래·교환 글 쓰기 (내 지역으로)",
)
async def create_trade(body: TradePostIn, user: CurrentUser, db: DbSession):
    # 글의 지역은 요청이 아니라 내 프로필에서 — 다른 지역으로 올리는 지역 조작 방지
    if user.region_code is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "먼저 내 지역을 설정해 주세요.")
    if body.kind in ("have", "sell") and body.condition is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "가진 물건·판매 글은 상품 상태를 골라 주세요.")
    if contains_private_info(body.item_name, body.content):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "공개 글에는 연락처(전화번호·이메일·오픈채팅)나 정확한 장소(동·호수, 번지)를 쓸 수 없습니다.",
        )
    if body.product_id is not None and await db.get(Product, body.product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "상품을 찾을 수 없습니다.")
    if body.interest_id is not None and await db.get(Interest, body.interest_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 취향입니다.")

    mine = await db.scalars(
        select(TradePost).where(TradePost.user_id == user.id, TradePost.kind == body.kind, TradePost.status == "open")
    )
    if any(
        (body.product_id is not None and p.product_id == body.product_id)
        or normalize(p.item_name) == normalize(body.item_name)
        for p in mine
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "같은 물건으로 진행 중인 글이 이미 있습니다.")

    post = TradePost(user_id=user.id, region_code=user.region_code, **body.model_dump())
    db.add(post)
    await db.commit()
    post = await db.scalar(select(TradePost).where(TradePost.id == post.id).execution_options(populate_existing=True))
    return post_out(post, await load_tree(db), user.id)


@router.patch("/trades/{post_id}", response_model=TradePostOut, summary="내 글 상태 변경 (거래 완료·숨김)")
async def update_trade_status(post_id: int, body: TradeStatusIn, user: CurrentUser, db: DbSession):
    post = await db.get(TradePost, post_id)
    if post is None or post.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "거래글을 찾을 수 없습니다.")
    post.status = body.status
    await db.commit()
    return post_out(post, await load_tree(db), user.id)


@router.get("/trades/matches", response_model=list[TradeMatchOut], summary="내 WANT ↔ 같은 구 이웃의 HAVE·SELL 매칭")
async def trade_matches(user: CurrentUser, db: DbSession):
    """HAVE/WANT 일치 + 같은 지역까지만 (거리·신뢰도·시간은 향후). 맞교환 가능 → 같은 생활권 → 최신 순"""
    tree = await load_tree(db)
    open_posts = list(await db.scalars(select(TradePost).where(TradePost.status == "open")))
    my_wants = [p for p in open_posts if p.user_id == user.id and p.kind == "want"]
    my_offers = [p for p in open_posts if p.user_id == user.id and p.kind in ("have", "sell")]
    wants_by_user: dict[int, list[TradePost]] = {}
    for p in open_posts:
        if p.kind == "want":
            wants_by_user.setdefault(p.user_id, []).append(p)

    def nearby(a: TradePost, b: TradePost) -> Literal["same_zone", "same_district"] | None:
        if a.region_code == b.region_code:
            return "same_zone"
        district = tree.district_of(a.region_code)
        if district is not None and district == tree.district_of(b.region_code):
            return "same_district"
        return None

    matches: list[tuple[TradeMatchOut, TradePost]] = []
    for want in my_wants:
        for offer in open_posts:
            if offer.user_id == user.id or offer.kind not in ("have", "sell") or not same_item(want, offer):
                continue
            proximity = nearby(want, offer)
            if proximity is None:
                continue
            mutual = any(
                same_item(theirs, mine) for theirs in wants_by_user.get(offer.user_id, []) for mine in my_offers
            )
            matches.append(
                (
                    TradeMatchOut(
                        want=post_out(want, tree, user.id),
                        offer=post_out(offer, tree, user.id),
                        proximity=proximity,
                        mutual=mutual,
                    ),
                    offer,
                )
            )
    matches.sort(key=lambda m: (not m[0].mutual, m[0].proximity != "same_zone", -m[1].created_at.timestamp(), -m[1].id))
    return [m for m, _ in matches]


@router.get("/wish-map", response_model=list[WishMapOut], summary="지역 인기 찜 상품 (5명 이상만, 하위 지역 합산)")
async def wish_map(
    db: DbSession,
    region: Annotated[str, Query(max_length=12, description="지역 코드")],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    """개인 찜 목록은 공개하지 않고 집계 참여자 수만 센다 (테스트 계정 제외)"""
    tree = await load_tree(db)
    if region not in tree.by_code:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 지역입니다.")

    rows = await db.execute(
        select(User.region_code, Wishlist.product_id, func.count())
        .join(User, User.id == Wishlist.user_id)
        .where(
            User.fandom_opt_in.is_(True),
            User.region_code.is_not(None),
            User.email.not_like(f"%{local_stats.EXCLUDED_EMAIL_SUFFIX}"),
        )
        .group_by(User.region_code, Wishlist.product_id)
    )
    real = rollup(tree, {(r, pid): n for r, pid, n in rows})
    # 덕력지도와 같은 방식: 실제 찜이 있는 칸은 실제 값, 없는 칸만 샘플로 채운다
    samples = rollup(tree, {(s.region_code, s.product_id): s.count for s in await db.scalars(select(WishSample))})
    cells = {key: (n, True) for key, n in samples.items() if n > 0}
    cells.update({key: (n, False) for key, n in real.items() if n > 0})
    ranked = sorted(
        ((n, pid, sample) for (code, pid), (n, sample) in cells.items() if code == region and n >= MIN_GROUP_SIZE),
        key=lambda x: (-x[0], x[1]),
    )[:limit]
    products = {p.id: p for p in await db.scalars(select(Product).where(Product.id.in_([pid for _, pid, _ in ranked])))}
    return [
        WishMapOut(rank=rank, product=ProductOut.from_model(products[pid]), count=n, is_sample=sample)
        for rank, (n, pid, sample) in enumerate(ranked, 1)
    ]


@router.get(
    "/wish-wants",
    response_model=list[WishWantsOut],
    summary="위시맵 지역 블록별 진행 중 WANT 글 수와 핀 이미지 (하위 지역 포함)",
)
async def wish_wants(
    db: DbSession,
    codes: Annotated[str, Query(max_length=600, description="쉼표로 구분한 지역 코드 (최대 40개)")],
):
    tree = await load_tree(db)
    wanted = [c for c in dict.fromkeys(codes.split(",")) if c][:40]
    if not wanted or any(c not in tree.by_code for c in wanted):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 지역입니다.")
    posts = list(
        await db.scalars(
            select(TradePost)
            .where(TradePost.status == "open", TradePost.kind == "want")
            .order_by(TradePost.created_at.desc(), TradePost.id.desc())
        )
    )
    out = []
    for code in wanted:
        inside = [p for p in posts if code in tree.ancestors(p.region_code)]
        out.append(
            WishWantsOut(
                region_code=code,
                count=len(inside),
                images=[p.product.image_url if p.product else None for p in inside[:4]],
                sample=bool(inside) and all(p.is_sample for p in inside),
            )
        )
    return out


@router.get("/trades/{post_id}", response_model=TradePostOut, summary="거래글 하나 (진행 중이거나 내 글)")
async def get_trade(post_id: int, db: DbSession, viewer: OptionalUser):
    post = await db.get(TradePost, post_id)
    viewer_id = viewer.id if viewer else None
    if post is None or (post.status != "open" and post.user_id != viewer_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "거래글을 찾을 수 없습니다.")
    return post_out(post, await load_tree(db), viewer_id)
