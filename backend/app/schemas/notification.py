from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    content: str
    read_status: bool
    link_url: Optional[str] = None
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    broadcast_id: Optional[UUID] = None
    opened_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}
