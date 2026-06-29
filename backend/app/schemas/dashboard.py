from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.community import CommunityResponse
from app.schemas.post import PostResponse
from app.schemas.startup import StartupResponse
from app.schemas.user import UserRecommendation


class DashboardAnnouncement(BaseModel):
    id: str
    title: str
    content: str
    priority: str = "medium"
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    dismissible: bool = True
    created_at: Optional[datetime] = None
    created_by_name: Optional[str] = None


class DashboardStats(BaseModel):
    connections_count: int
    posts_count: int
    communities_count: int
    unread_notifications: int


class CountryDiscoveryItem(BaseModel):
    country: str
    count: int


class DashboardActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    link: Optional[str] = None


class DashboardResponse(BaseModel):
    stats: DashboardStats
    pinned_posts: List[PostResponse] = []
    official_posts: List[PostResponse] = []
    announcements: List[DashboardAnnouncement] = []
    recommendations: List[UserRecommendation]
    recommendations_total: int = 0
    recommendations_has_more: bool = False
    trending_posts: List[PostResponse]
    active_communities: List[CommunityResponse]
    startup_suggestions: List[StartupResponse]
    country_discovery: List[CountryDiscoveryItem] = []
    trending_opportunities: List[PostResponse] = []
    recent_activity: List[DashboardActivityItem] = []
