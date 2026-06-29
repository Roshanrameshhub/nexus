from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class BroadcastDeliveryOptions(BaseModel):
    show_in_dashboard: bool = True
    show_in_notification_center: bool = True
    send_in_app_notification: bool = True
    send_browser_push: bool = True
    send_mobile_push: bool = False


class BroadcastAudienceOptions(BaseModel):
    audience: str = "all"
    custom_audience: Optional[str] = None
    target_country: Optional[str] = Field(None, max_length=100)
    target_city: Optional[str] = Field(None, max_length=120)


class BroadcastAnnouncementCreate(BroadcastAudienceOptions, BroadcastDeliveryOptions):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    priority: str = "medium"
    expires_at: Optional[datetime] = None
    publish_at: Optional[datetime] = None
    cta_label: Optional[str] = Field(None, max_length=100)
    cta_url: Optional[str] = Field(None, max_length=500)


class BroadcastAdminPostCreate(BroadcastAudienceOptions, BroadcastDeliveryOptions):
    content: str = Field(min_length=1)
    post_type: str = "text"
    media: Optional[List[str]] = None
    hashtags: Optional[List[str]] = None
    poll_options: Optional[List[str]] = None
    official_label: str = Field(default="RConnectX Team", max_length=120)
    show_in_announcements_hub: bool = False
    title: Optional[str] = Field(None, max_length=255)


class BroadcastNotificationCreate(BroadcastAudienceOptions, BroadcastDeliveryOptions):
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    link_url: Optional[str] = Field(None, max_length=500)


class BroadcastResponse(BaseModel):
    id: UUID
    broadcast_type: str
    title: str
    content: str
    audience: str
    view_count: int = 0
    click_count: int = 0
    notification_open_count: int = 0
    push_delivery_count: int = 0
    announcement_id: Optional[UUID] = None
    post_id: Optional[UUID] = None
    created_at: datetime
    recipients_notified: Optional[int] = None

    model_config = {"from_attributes": True}


class PushTokenRegister(BaseModel):
    platform: str = Field(pattern="^(web|android|ios)$")
    token: str = Field(min_length=1, max_length=512)
    subscription_json: Optional[str] = None
