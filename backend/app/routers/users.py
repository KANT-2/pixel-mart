from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.deps import CurrentUser, DbSession, OptionalUser
from app.schemas.user import AvatarIn, NicknameCheckOut, UserOut, UserUpdateIn
from app.services.nickname import is_taken

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/nickname-check", response_model=NicknameCheckOut, summary="닉네임 사용 가능 여부 (대소문자 구분 없음)")
async def nickname_check(
    db: DbSession,
    viewer: OptionalUser,
    nickname: Annotated[str, Query(min_length=1, max_length=30)],
):
    taken = await is_taken(db, nickname, viewer.id if viewer else None)
    return NicknameCheckOut(nickname=nickname.strip(), available=bool(nickname.strip()) and not taken)


@router.patch("/me", response_model=UserOut, summary="닉네임 변경 (이미 쓰는 닉네임이면 409)")
async def update_me(body: UserUpdateIn, user: CurrentUser, db: DbSession):
    if await is_taken(db, body.nickname, user.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 사용 중인 닉네임이에요.")
    user.nickname = body.nickname
    await db.commit()
    return user


@router.put("/me/avatar", response_model=UserOut, summary="픽셀 아바타 저장 (PNG data URL, 50KB 이하)")
async def put_avatar(body: AvatarIn, user: CurrentUser, db: DbSession):
    user.avatar_url = body.avatar_url
    await db.commit()
    return user


@router.delete("/me/avatar", response_model=UserOut, summary="아바타 삭제 (기본 슬라임으로)")
async def delete_avatar(user: CurrentUser, db: DbSession):
    user.avatar_url = None
    await db.commit()
    return user
