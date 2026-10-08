from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.schemas.user import AvatarIn, UserOut, UserUpdateIn

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserOut, summary="닉네임 변경")
async def update_me(body: UserUpdateIn, user: CurrentUser, db: DbSession):
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
