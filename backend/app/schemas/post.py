from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel

from app.schemas.user import UserPublic


class OpportunityDetails(BaseModel):
    title: str
    organization: str
    opportunity_type: str
    location: Optional[str] = None
    work_mode: Optional[str] = None  # remote | hybrid | onsite
    application_link: Optional[str] = None
    expiry_date: Optional[str] = None


class PollOptionInput(BaseModel):
    id: str
    text: str


class PollDetailsInput(BaseModel):
    options: List[PollOptionInput]


class PollOptionResponse(BaseModel):
    id: str
    text: str
    vote_count: int = 0
    percentage: float = 0.0


class PollDetailsResponse(BaseModel):
    options: List[PollOptionResponse] = []
    total_votes: int = 0
    user_vote_option_id: Optional[str] = None


class PostCreate(BaseModel):
    content: str
    media: Optional[List[str]] = None
    post_type: Optional[str] = "text"
    hashtags: Optional[List[str]] = None
    mentions: Optional[List[str]] = None
    opportunity_details: Optional[OpportunityDetails] = None
    poll_details: Optional[PollDetailsInput] = None


class PostUpdate(BaseModel):
    content: Optional[str] = None
    media: Optional[List[str]] = None


class PollVoteRequest(BaseModel):
    option_id: str

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
    opportunity_details: Optional[dict] = None
    poll_details: Optional[PollDetailsResponse] = None
    is_official: bool = False
    official_label: Optional[str] = None
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
