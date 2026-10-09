"""PIXEL LOCAL ① 지역·취향 설정 (GPS 없이 시 › 구 › 동·생활권 직접 선택, 집계 참여·공개는 opt-in)"""

import random
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, func, select

from app.deps import CurrentUser, DbSession
from app.models import FandomSample, Interest, Region, User, UserInterest
from app.schemas.local import (
    FandomOut,
    FandomRankOut,
    InterestOut,
    InterestType,
    LocalProfileIn,
    LocalProfileOut,
    MapAvatarsOut,
    RegionOut,
)
from app.services import local_stats
from app.services.local_stats import MIN_GROUP_SIZE, Period, period_start, present, rollup
from app.services.regions import RegionTree, load_tree

router = APIRouter(tags=["local"])


def region_out(tree: RegionTree, code: str) -> RegionOut:
    r = tree.by_code[code]
    return RegionOut(code=r.code, level=r.level, parent_code=r.parent_code, name=r.name, full_name=tree.full_name(code))


@router.get("/regions", response_model=list[RegionOut], summary="지역 목록 (parent 없으면 시, 있으면 그 아래 단계)")
async def list_regions(db: DbSession, parent: Annotated[str | None, Query(max_length=12)] = None):
    tree = await load_tree(db)
    if parent is not None and parent not in tree.by_code:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 지역입니다.")
    children = sorted((r for r in tree.by_code.values() if r.parent_code == parent), key=lambda r: r.code)
    return [region_out(tree, r.code) for r in children]


@router.get("/interests", response_model=list[InterestOut], summary="취향 태그 검색 (작품·캐릭터·스타일·상품 종류)")
async def list_interests(
    db: DbSession,
    type: InterestType | None = None,
    q: Annotated[str | None, Query(max_length=30, description="이름 검색어")] = None,
):
    stmt = select(Interest).order_by(Interest.type, Interest.id)
    if type:
        stmt = stmt.where(Interest.type == type)
    if q:
        stmt = stmt.where(Interest.name.ilike(f"%{q.strip()}%"))
    return (await db.scalars(stmt)).all()


async def _profile_out(db: DbSession, user: User) -> LocalProfileOut:
    interests = await db.scalars(
        select(Interest).join(UserInterest).where(UserInterest.user_id == user.id).order_by(Interest.type, Interest.id)
    )
    return LocalProfileOut(
        region=region_out(await load_tree(db), user.region_code) if user.region_code else None,
        interests=[InterestOut.model_validate(i) for i in interests],
        fandom_opt_in=user.fandom_opt_in,
        profile_public=user.profile_public,
        map_avatar_opt_in=user.map_avatar_opt_in,
    )


@router.get("/users/me/local", response_model=LocalProfileOut, summary="내 지역·취향·집계 참여·공개 여부")
async def get_my_local(user: CurrentUser, db: DbSession):
    return await _profile_out(db, user)


@router.put(
    "/users/me/local", response_model=LocalProfileOut, summary="내 지역·취향·집계 참여·공개 여부 설정 (전체 교체)"
)
async def put_my_local(body: LocalProfileIn, user: CurrentUser, db: DbSession):
    if body.region_code is not None and await db.get(Region, body.region_code) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "존재하지 않는 지역입니다.")

    wanted = set(body.interest_ids)
    found = set(await db.scalars(select(Interest.id).where(Interest.id.in_(wanted)))) if wanted else set()
    if found != wanted:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "존재하지 않는 취향이 있습니다.")

    user.region_code = body.region_code
    user.fandom_opt_in = body.fandom_opt_in
    user.profile_public = body.profile_public
    user.map_avatar_opt_in = body.map_avatar_opt_in
    # 계속 고른 취향은 그대로 두어 고른 시각(집계 기간 기준)을 유지
    current = set(await db.scalars(select(UserInterest.interest_id).where(UserInterest.user_id == user.id)))
    if removed := current - wanted:
        await db.execute(
            delete(UserInterest).where(UserInterest.user_id == user.id, UserInterest.interest_id.in_(removed))
        )
    db.add_all(UserInterest(user_id=user.id, interest_id=i) for i in wanted - current)
    await db.commit()
    return await _profile_out(db, user)


async def _fandom_cells(db: DbSession, tree: RegionTree, period: Period) -> dict[tuple[str, int], tuple[int, bool]]:
    """(지역, 취향) → (인원, 샘플 여부). 실제 데이터가 있는 칸은 실제 값, 없는 칸만 샘플로 채운다"""
    since = period_start(period)
    stmt = (
        select(User.region_code, UserInterest.interest_id, func.count())
        .join(User, User.id == UserInterest.user_id)
        .where(
            User.fandom_opt_in.is_(True),
            User.region_code.is_not(None),
            User.email.not_like(f"%{local_stats.EXCLUDED_EMAIL_SUFFIX}"),
        )
        .group_by(User.region_code, UserInterest.interest_id)
    )
    if since is not None:
        stmt = stmt.where(UserInterest.created_at >= since)
    real = rollup(tree, {(r, i): n for r, i, n in await db.execute(stmt)})

    samples = rollup(tree, {(s.region_code, s.interest_id): s.count for s in await db.scalars(select(FandomSample))})
    cells = {key: (n, True) for key, n in samples.items() if n > 0}
    cells.update({key: (n, False) for key, n in real.items() if n > 0})
    return cells


async def _check_filters(db: DbSession, tree: RegionTree, region: str | None, interest: int | None) -> None:
    if region is not None and region not in tree.by_code:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 지역입니다.")
    if interest is not None and await db.get(Interest, interest) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "존재하지 않는 취향입니다.")


@router.get(
    "/local/fandom", response_model=list[FandomOut], summary="덕력지도: 지역 × 취향 인원 (5명 미만 숫자 비공개)"
)
async def fandom_map(
    db: DbSession,
    region: Annotated[str | None, Query(max_length=12, description="지역 코드 — 하위 지역 합산")] = None,
    interest: Annotated[int | None, Query(description="취향 id — 그 취향의 지역별 인원")] = None,
    type: InterestType | None = None,
    period: Period = "all",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    """집계 참여(fandomOptIn)를 켠 사용자 수만 센다(같은 사람은 1명). 테스트 계정은 제외"""
    tree = await load_tree(db)
    await _check_filters(db, tree, region, interest)
    cells = await _fandom_cells(db, tree, period)
    interests = {i.id: i for i in await db.scalars(select(Interest))}

    rows = []
    for (code, iid), (n, is_sample) in cells.items():
        if (region and code != region) or (interest and iid != interest) or (type and interests[iid].type != type):
            continue
        count, below = present(n)
        rows.append(
            FandomOut(
                region_code=code,
                region_name=tree.full_name(code),
                interest_id=iid,
                interest=interests[iid].name,
                interest_type=interests[iid].type,
                count=count,
                below_threshold=below,
                is_sample=is_sample,
            )
        )
    # 기준 미만 칸끼리는 인원순으로 정렬하지 않는다 (순서로 숫자를 짐작하지 못하게)
    rows.sort(key=lambda r: (r.below_threshold, -(r.count or 0), r.region_code, r.interest_id))
    return rows[:limit]


@router.get("/local/fandom/ranking", response_model=list[FandomRankOut], summary="지역 인기 취향 순위 (5명 이상만)")
async def fandom_ranking(
    db: DbSession,
    region: Annotated[str, Query(max_length=12, description="지역 코드 — 하위 지역 합산")],
    type: InterestType | None = None,
    period: Period = "all",
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
):
    tree = await load_tree(db)
    await _check_filters(db, tree, region, None)
    cells = await _fandom_cells(db, tree, period)
    interests = {i.id: i for i in await db.scalars(select(Interest))}

    ranked = sorted(
        (
            (n, iid, is_sample)
            for (code, iid), (n, is_sample) in cells.items()
            if code == region and n >= MIN_GROUP_SIZE and (type is None or interests[iid].type == type)
        ),
        key=lambda x: (-x[0], x[1]),
    )[:limit]
    return [
        FandomRankOut(
            rank=rank,
            interest_id=iid,
            interest=interests[iid].name,
            interest_type=interests[iid].type,
            count=n,
            is_sample=is_sample,
        )
        for rank, (n, iid, is_sample) in enumerate(ranked, 1)
    ]


MAX_MAP_AVATARS = 6


@router.get(
    "/local/map-avatars",
    response_model=list[MapAvatarsOut],
    summary="덕력지도 아바타 핀: 보고 있는 지역의 하위 지역별 동의자 아바타 (5명 미만 비공개)",
)
async def map_avatars(
    db: DbSession,
    region: Annotated[str | None, Query(max_length=12, description="보고 있는 지역 — 없으면 시 단계")] = None,
    interest: Annotated[int | None, Query(description="이 취향을 고른 사람만")] = None,
):
    tree = await load_tree(db)
    await _check_filters(db, tree, region, interest)
    blocks = [r.code for r in tree.by_code.values() if r.parent_code == region] or ([region] if region else [])

    stmt = select(User.region_code, User.avatar_url).where(
        User.map_avatar_opt_in.is_(True),
        User.region_code.is_not(None),
        User.email.not_like(f"%{local_stats.EXCLUDED_EMAIL_SUFFIX}"),
    )
    if interest is not None:
        stmt = stmt.join(UserInterest, UserInterest.user_id == User.id).where(UserInterest.interest_id == interest)
    by_block: dict[str, list[str | None]] = {code: [] for code in blocks}
    for region_code, avatar_url in await db.execute(stmt):
        for code in tree.ancestors(region_code):  # 하위 지역 사람도 상위 블록에 포함
            if code in by_block:
                by_block[code].append(avatar_url)

    out = []
    for code in sorted(blocks):
        avatars = by_block[code]
        enough = len(avatars) >= MIN_GROUP_SIZE
        out.append(
            MapAvatarsOut(
                region_code=code,
                region_name=tree.full_name(code),
                count=len(avatars) if enough else None,
                below_threshold=not enough,
                # 매번 무작위로 뽑아 순서·구성으로 개인을 추정하기 어렵게 한다
                avatars=random.sample(avatars, min(len(avatars), MAX_MAP_AVATARS)) if enough else [],
            )
        )
    return out
