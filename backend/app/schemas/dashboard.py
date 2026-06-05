from typing import List

from pydantic import BaseModel

from app.schemas.community import CommunityResponse
from app.schemas.post import PostResponse
from app.schemas.startup import StartupResponse
from app.schemas.user import UserRecommendation


class DashboardStats(BaseModel):
    connections_count: int
    posts_count: int
    communities_count: int
    unread_notifications: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    recommendations: List[UserRecommendation]
    trending_posts: List[PostResponse]
    active_communities: List[CommunityResponse]
    startup_suggestions: List[StartupResponse]
