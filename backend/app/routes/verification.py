import re
import uuid
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.admin_console import VerificationRequest, VerificationStatus
from app.models.user import User
from app.routes.upload import EXTENSION_MIME, _validate_upload
from app.schemas.verification import (
    UserVerificationRequestResponse,
    UserVerificationStatusResponse,
)
from app.utils.paths import UPLOAD_DIR

router = APIRouter(prefix="/verification", tags=["Verification"])

ALLOWED_DOCUMENT_TYPES = {"college_id", "company_id"}
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
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    document_type: Annotated[str, Form()] = ...,
    file: UploadFile = File(...),
):
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="document_type must be college_id or company_id",
        )

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

    content = await file.read()
    images_only = file.content_type != "application/pdf" and not (
        file.filename or ""
    ).lower().endswith(".pdf")
    ext = _validate_upload(file.filename, content, images_only=images_only)

    unique_filename = f"{uuid.uuid4()}.{ext}"
    document_url = f"/uploads/{unique_filename}"
    mime_type = EXTENSION_MIME.get(ext, file.content_type or "application/octet-stream")

    # Keep a disk copy for local dev; verification retrieval prefers DB bytes.
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / unique_filename
    file_path.write_bytes(content)

    req = VerificationRequest(
        user_id=current_user.id,
        document_type=document_type,
        document_url=document_url,
        document_content=content,
        document_mime=mime_type,
        status=VerificationStatus.pending.value,
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return UserVerificationRequestResponse.model_validate(req)


@router.get("/document")
async def get_my_verification_document(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(VerificationRequest)
        .where(VerificationRequest.user_id == current_user.id)
        .order_by(desc(VerificationRequest.created_at))
        .limit(1)
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No verification request found")

    if req.document_content:
        return Response(
            content=req.document_content,
            media_type=req.document_mime or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="verification-{req.id}"'},
        )

    filename = req.document_url.rsplit("/", 1)[-1] if req.document_url else ""
    file_path = UPLOAD_DIR / filename
    if not filename or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type=req.document_mime or "application/octet-stream",
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
