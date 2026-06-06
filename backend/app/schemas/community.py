from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class CommunityActivityMetrics(BaseModel):
    total_discussions: int = 0
    discussions_this_week: int = 0
    total_likes: int = 0
    total_comments: int = 0


class CommunityResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    creator_id: UUID
    member_count: int = 0
    is_member: bool = False
    created_at: datetime
    activity: Optional[CommunityActivityMetrics] = None

    model_config = {"from_attributes": True}


class DiscussionCreate(BaseModel):
    title: str
    content: str


class DiscussionCommentCreate(BaseModel):
    content: str


class DiscussionCommentResponse(BaseModel):
    id: UUID
    content: str
    created_at: datetime
    author: UserPublic
    replies_count: int = 0

    model_config = {"from_attributes": True}


class DiscussionResponse(BaseModel):
    id: UUID
    community_id: UUID
    title: str
    content: str
    created_at: datetime
    author: UserPublic
    likes_count: int = 0
    comments_count: int = 0
    views_count: int = 0
    shares_count: int = 0
    is_pinned: bool = False
    liked: bool = False
    community_name: Optional[str] = None

    model_config = {"from_attributes": True}
