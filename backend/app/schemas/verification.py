from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class VerificationSubmitRequest(BaseModel):
    document_type: Literal["college_id", "company_id"]
    document_url: str = Field(min_length=1, max_length=500)


class UserVerificationRequestResponse(BaseModel):
    id: UUID
    document_type: str
    document_url: str
    status: str
    review_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserVerificationStatusResponse(BaseModel):
    is_verified: bool
    status: Literal["not_verified", "pending", "verified", "rejected"]
    latest_request: Optional[UserVerificationRequestResponse] = None
    can_submit: bool
