from fastapi import APIRouter, HTTPException

from app.deps import CurrentUser
from app.schemas.ai_avatar import AiAvatarIn, AiAvatarOut
from app.services import ai_avatar

router = APIRouter(prefix="/avatars", tags=["users"])


@router.post("/ai", response_model=AiAvatarOut, summary="사진으로 AI 픽셀 아바타 만들기 (동의 필수, 저장 안 함)")
async def create_ai_avatar(body: AiAvatarIn, user: CurrentUser):
    try:
        ai_avatar.limiter.check(user.id)
        image = await ai_avatar.generate_pixel_avatar(body.photo)
    except ai_avatar.AiAvatarError as error:
        raise HTTPException(error.status, error.message) from None
    return AiAvatarOut(image=image)
