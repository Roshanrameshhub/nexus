from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.schemas.reports import CreateReportRequest, CreateReportResponse
from app.services.report_service import create_report

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("", response_model=CreateReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_report(
    body: CreateReportRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    report, is_high = await create_report(
        db,
        current_user,
        body.report_type,
        body.content_id,
        body.reason,
        body.notes,
    )
    return CreateReportResponse(
        id=report.id,
        message="Report submitted successfully",
        is_high_priority=is_high,
    )
