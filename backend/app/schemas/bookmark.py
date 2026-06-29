from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.post import PostResponse
from app.schemas.user import UserPublic


class RepostResponse(BaseModel):
    id: UUID
    original_post: PostResponse
    author: UserPublic
    caption: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BookmarkResponse(BaseModel):
    id: UUID
    post: PostResponse
    created_at: datetime

    model_config = {"from_attributes": True}


class RepostCreate(BaseModel):
    post_id: UUID
    caption: str | None = None
