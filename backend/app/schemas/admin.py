from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AdminOverviewResponse(BaseModel):
    total_users: int = 0
    new_users_today: int = 0
    active_users: int = 0
    daily_active_users: int = 0
    weekly_active_users: int = 0
    monthly_active_users: int = 0
    verified_users: int = 0
    pending_verifications: int = 0
    total_referrals: int = 0
    total_posts: int = 0
    total_sessions: int = 0
    open_reports: int = 0


class AdminUserListItem(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    platform_role: str
    country: Optional[str] = None
    is_suspended: bool = False
    is_verified: bool = False
    last_active_at: Optional[datetime] = None
    is_online: bool = False
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    referral_count: int = 0
    current_streak: int = 0
    longest_streak: int = 0
    streak_started_at: Optional[datetime] = None
    city: Optional[str] = None
    state: Optional[str] = None


class AdminUserDetail(AdminUserListItem):
    bio: Optional[str] = None
    college: Optional[str] = None
    company: Optional[str] = None
    posts_count: int = 0
    connections_count: int = 0
    login_streak_current: int = 0
    login_streak_longest: int = 0
    days_active_this_month: int = 0


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    audience: str = "all"
    priority: str = "medium"
    expires_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    cta_label: Optional[str] = Field(None, max_length=100)
    cta_url: Optional[str] = Field(None, max_length=500)
    custom_audience: Optional[str] = None
    target_country: Optional[str] = Field(None, max_length=100)
    target_city: Optional[str] = Field(None, max_length=120)
    show_in_dashboard: bool = True
    show_in_notification_center: bool = True
    send_in_app_notification: bool = True
    send_browser_push: bool = True
    send_mobile_push: bool = False


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    audience: Optional[str] = None
    priority: Optional[str] = None
    expires_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    cta_label: Optional[str] = Field(None, max_length=100)
    cta_url: Optional[str] = Field(None, max_length=500)
    custom_audience: Optional[str] = None
    target_country: Optional[str] = Field(None, max_length=100)
    target_city: Optional[str] = Field(None, max_length=120)
    show_in_dashboard: Optional[bool] = None
    show_in_notification_center: Optional[bool] = None
    send_in_app_notification: Optional[bool] = None
    send_browser_push: Optional[bool] = None
    send_mobile_push: Optional[bool] = None


class AnnouncementResponse(BaseModel):
    id: UUID
    title: str
    content: str
    audience: str
    priority: str = "medium"
    expires_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    view_count: int = 0
    click_count: int = 0
    dismiss_count: int = 0
    custom_audience: Optional[str] = None
    target_country: Optional[str] = None
    target_city: Optional[str] = None
    show_in_dashboard: bool = True
    show_in_notification_center: bool = True
    send_in_app_notification: bool = True
    send_browser_push: bool = True
    send_mobile_push: bool = False
    notification_open_count: int = 0
    push_delivery_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PinPostRequest(BaseModel):
    post_id: UUID
    pin_order: Optional[int] = None
    expiry_days: Optional[int] = Field(None, description="7, 14, 30, or null for never")


class PinnedPostResponse(BaseModel):
    id: UUID
    content: str
    pin_order: Optional[int] = None
    author_name: str
    created_at: datetime
    pinned_at: Optional[datetime] = None
    pinned_by_name: Optional[str] = None
    pin_expires_at: Optional[datetime] = None


class AdminContentPostResponse(BaseModel):
    id: UUID
    content: str
    image_url: Optional[str] = None
    media: List[str] = []
    post_type: Optional[str] = "text"
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    created_at: datetime
    author_name: str
    author_verified: bool = False
    author_avatar: Optional[str] = None
    is_pinned: bool = False
    pinned_at: Optional[datetime] = None
    pinned_by_name: Optional[str] = None
    pin_expires_at: Optional[datetime] = None
    trending_score: Optional[int] = None


class VerificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    user_role: str
    verification_type: str
    document_type: str
    document_type_label: str
    document_url: str
    status: str
    created_at: datetime
    review_note: Optional[str] = None


class VerificationReviewRequest(BaseModel):
    note: Optional[str] = None


class ReferralAnalyticsResponse(BaseModel):
    total_referrals: int
    top_referrers: List[dict]
    growth_last_30_days: int


class ReportResponse(BaseModel):
    id: UUID
    reporter_name: str
    target_type: str
    target_id: str
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime


class ResolveReportRequest(BaseModel):
    resolution_note: Optional[str] = None
    remove_content: bool = False


class AdminMeetingCreate(BaseModel):
    organizer_id: UUID
    invitee_id: UUID
    title: str
    description: Optional[str] = None
    scheduled_at: datetime
    meeting_type: str = "Admin Session"
    duration_minutes: int = 60


class AdminMeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    meeting_type: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None


class AnalyticsResponse(BaseModel):
    user_growth: List[dict]
    engagement: dict
    geography: dict
    networking: dict
    verification: dict


class AuditLogResponse(BaseModel):
    id: UUID
    actor_name: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
