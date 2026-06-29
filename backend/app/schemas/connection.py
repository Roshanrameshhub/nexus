from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class ConnectionRequestResponse(BaseModel):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    status: str
    created_at: datetime
    sender: UserPublic | None = None
    receiver: UserPublic | None = None

    model_config = {"from_attributes": True}


class ConnectionListResponse(BaseModel):
    connections: List[ConnectionRequestResponse]
    total: int
