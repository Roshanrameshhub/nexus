from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class ConversationCreate(BaseModel):
    participant_ids: List[UUID]


class MessageCreate(BaseModel):
    content: str = ""
    message_type: str = "text"
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None


class MessageResponse(BaseModel):
    id: UUID
    content: str
    sender_id: UUID
    timestamp: datetime
    sender: Optional[UserPublic] = None
    message_type: str = "text"
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: UUID
    participants: List[UserPublic]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread: int = 0

    model_config = {"from_attributes": True}
