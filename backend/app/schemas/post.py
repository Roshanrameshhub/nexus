from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class PostCreate(BaseModel):
    content: str
    media: Optional[List[str]] = None
    post_type: Optional[str] = "text"
    hashtags: Optional[List[str]] = None
    mentions: Optional[List[str]] = None


class PostUpdate(BaseModel):
    content: Optional[str] = None
    media: Optional[List[str]] = None


class PostResponse(BaseModel):
    id: UUID
    content: str
    image_url: Optional[str] = None
    media: List[str] = []
    post_type: Optional[str] = "text"
    hashtags: Optional[List[str]] = None
    mentions: Optional[List[str]] = None
    likes_count: int
    reactions_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    views_count: int = 0
    created_at: datetime
    author: UserPublic
    liked: bool = False

    model_config = {"from_attributes": True}


class PostListResponse(BaseModel):
    posts: List[PostResponse]
    page: int
    limit: int
    total: int
    has_more: bool
