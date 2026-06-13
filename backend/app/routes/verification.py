import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.admin_console import VerificationRequest, VerificationStatus
from app.models.user import User
from app.schemas.verification import (
    UserVerificationRequestResponse,
    UserVerificationStatusResponse,
    VerificationSubmitRequest,
)

router = APIRouter(prefix="/verification", tags=["Verification"])

ALLOWED_DOCUMENT_URL = re.compile(
    r"^/uploads/[a-f0-9\-]+\.(jpg|jpeg|png|pdf)$",
    re.IGNORECASE,
)


def _resolve_status(user: User, latest: VerificationRequest | None) -> str:
    if user.is_verified:
        return "verified"
    if latest and latest.status == VerificationStatus.pending.value:
        return "pending"
    if latest and latest.status == VerificationStatus.rejected.value:
        return "rejected"
    return "not_verified"


@router.get("/me", response_model=UserVerificationStatusResponse)
async def get_my_verification(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == current_user.id)
        .order_by(desc(VerificationRequest.created_at))
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    resolved = _resolve_status(current_user, latest)
    can_submit = not current_user.is_verified and (
        latest is None or latest.status != VerificationStatus.pending.value
    )

    return UserVerificationStatusResponse(
        is_verified=current_user.is_verified,
        status=resolved,
        latest_request=(
            UserVerificationRequestResponse.model_validate(latest) if latest else None
        ),
        can_submit=can_submit,
    )


@router.post("", response_model=UserVerificationRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_verification(
    body: VerificationSubmitRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your account is already verified",
        )

    pending = await db.execute(
        select(VerificationRequest).where(
            VerificationRequest.user_id == current_user.id,
            VerificationRequest.status == VerificationStatus.pending.value,
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a verification request pending review",
        )

    if not ALLOWED_DOCUMENT_URL.match(body.document_url.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document URL. Upload a JPG, PNG, or PDF first.",
        )

    req = VerificationRequest(
        user_id=current_user.id,
        document_type=body.document_type,
        document_url=body.document_url.strip(),
        status=VerificationStatus.pending.value,
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return UserVerificationRequestResponse.model_validate(req)
