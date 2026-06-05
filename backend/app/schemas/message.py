from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class ConversationCreate(BaseModel):
    participant_ids: List[UUID]


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    id: UUID
    content: str
    sender_id: UUID
    timestamp: datetime
    sender: Optional[UserPublic] = None

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    id: UUID
    participants: List[UserPublic]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread: int = 0

    model_config = {"from_attributes": True}
