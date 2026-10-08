"""PIXEL LOCAL ① 지역·취향 설정 (GPS 없이 시 › 구 › 동·생활권 직접 선택, 집계 참여·공개는 opt-in)"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import delete, select

from app.deps import CurrentUser, DbSession
from app.models import Interest, Region, User, UserInterest
from app.schemas.local import InterestOut, InterestType, LocalProfileIn, LocalProfileOut, RegionOut
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
    # 계속 고른 취향은 그대로 두어 고른 시각(집계 기간 기준)을 유지
    current = set(await db.scalars(select(UserInterest.interest_id).where(UserInterest.user_id == user.id)))
    if removed := current - wanted:
        await db.execute(
            delete(UserInterest).where(UserInterest.user_id == user.id, UserInterest.interest_id.in_(removed))
        )
    db.add_all(UserInterest(user_id=user.id, interest_id=i) for i in wanted - current)
    await db.commit()
    return await _profile_out(db, user)
