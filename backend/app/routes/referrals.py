from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.schemas.referral import ReferralMeResponse
from app.services.referral_service import ensure_referral_code

router = APIRouter(prefix="/referrals", tags=["Referrals"])
settings = get_settings()


@router.get("/me", response_model=ReferralMeResponse)
async def get_my_referral_info(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await ensure_referral_code(db, current_user)
    await db.flush()

    base = settings.FRONTEND_URL.rstrip("/")
    code = current_user.referral_code or ""
    return ReferralMeResponse(
        referral_code=code,
        referral_count=current_user.referral_count or 0,
        referral_link=f"{base}/signup?ref={code}",
    )
