from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.user import UserPublic


class MeetingCreate(BaseModel):
    invitee_id: UUID
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    meeting_type: str = "Mentorship Session"
    duration_minutes: int = Field(default=60, ge=15, le=480)
    user_time_zone: Optional[str] = "UTC"


class MeetingAccept(BaseModel):
    user_time_zone: Optional[str] = "UTC"


class MeetingReschedule(BaseModel):
    scheduled_at: datetime
    duration_minutes: Optional[int] = Field(default=None, ge=15, le=480)
    title: Optional[str] = None
    description: Optional[str] = None
    user_time_zone: Optional[str] = "UTC"


class MeetingNotesUpdate(BaseModel):
    notes: str


class MeetingResponse(BaseModel):
    id: UUID
    organizer_id: UUID
    invitee_id: UUID
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    meeting_type: str
    duration_minutes: int
    meet_link: str
    meeting_provider: str
    calendar_event_id: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    organizer: Optional[UserPublic] = None
    invitee: Optional[UserPublic] = None

    model_config = {"from_attributes": True}
