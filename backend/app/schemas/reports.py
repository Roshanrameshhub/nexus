from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CreateReportRequest(BaseModel):
    report_type: str = Field(..., description="post | ecosystem_post | comment | profile")
    content_id: str
    reason: str
    notes: Optional[str] = None


class CreateReportResponse(BaseModel):
    id: UUID
    message: str
    is_high_priority: bool = False


class ReporterInfo(BaseModel):
    id: UUID
    name: str


class ReportGroupResponse(BaseModel):
    target_type: str
    target_id: str
    reported_user_id: Optional[UUID] = None
    reported_user_name: Optional[str] = None
    content_preview: Optional[str] = None
    reasons: List[str]
    report_count: int
    reporters: List[ReporterInfo]
    is_high_priority: bool
    status: str
    latest_report_at: datetime
    report_ids: List[UUID]


class ModerationActionRequest(BaseModel):
    target_type: str
    target_id: str
    action: str
    note: Optional[str] = None


class WarnUserRequest(BaseModel):
    message: Optional[str] = None


class DeleteUserRequest(BaseModel):
    confirm_email: str
