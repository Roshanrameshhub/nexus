from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None


class TeamInvite(BaseModel):
    email: EmailStr


class ChannelCreate(BaseModel):
    name: str


class ChannelResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    creator_id: UUID
    member_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
