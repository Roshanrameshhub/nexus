from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = None


class CommunityResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    creator_id: UUID
    member_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DiscussionCreate(BaseModel):
    title: str
    content: str


class DiscussionResponse(BaseModel):
    id: UUID
    title: str
    content: str
    created_at: datetime
    author: UserPublic

    model_config = {"from_attributes": True}
