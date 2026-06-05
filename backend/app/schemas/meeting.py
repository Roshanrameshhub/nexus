from datetime import datetime
from uuid import UUID
from pydantic import BaseModel
from typing import Optional
from app.schemas.user import UserPublic


class MeetingCreate(BaseModel):
    invitee_id: UUID
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    meeting_type: str = "Mentorship"
    user_time_zone: Optional[str] = "UTC"  # IANA timezone string from frontend


class MeetingAccept(BaseModel):
    user_time_zone: Optional[str] = "UTC"  # Accepting user's local timezone


class MeetingResponse(BaseModel):
    id: UUID
    organizer_id: UUID
    invitee_id: UUID
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    meeting_type: str
    meet_link: str
    status: str
    created_at: datetime
    organizer: Optional[UserPublic] = None
    invitee: Optional[UserPublic] = None

    model_config = {"from_attributes": True}
