from fastapi import APIRouter, HTTPException

from app.deps import CurrentUser
from app.schemas.ai_avatar import AiAvatarIn, AiAvatarOut, AiAvatarStatusOut
from app.services import ai_avatar

router = APIRouter(prefix="/avatars", tags=["users"])


@router.get("/ai", response_model=AiAvatarStatusOut, summary="AI 픽셀 아바타 사용 가능 여부·제공자 (동의 문구용)")
async def ai_avatar_status():
    enabled = ai_avatar.is_configured()
    return AiAvatarStatusOut(
        enabled=enabled,
        provider="cloudflare" if enabled else None,
        provider_name=ai_avatar.PROVIDER_NAME if enabled else None,
        max_photo_side=ai_avatar.CLOUDFLARE_MAX_SIDE,
    )


@router.post("/ai", response_model=AiAvatarOut, summary="사진으로 AI 픽셀 아바타 만들기 (동의 필수, 저장 안 함)")
async def create_ai_avatar(body: AiAvatarIn, user: CurrentUser):
    try:
        ai_avatar.limiter.check(user.id)
        image = await ai_avatar.generate_pixel_avatar(body.photo)
    except ai_avatar.AiAvatarError as error:
        raise HTTPException(error.status, error.message) from None
    return AiAvatarOut(image=image)
