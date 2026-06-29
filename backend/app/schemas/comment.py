from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class CommentResponse(BaseModel):
    id: UUID
    content: str
    created_at: datetime
    author: UserPublic
    reactions_count: int = 0
    replies_count: int = 0

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str
