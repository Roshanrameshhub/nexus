from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    type: str
    content: str
    read_status: bool
    created_at: datetime

    model_config = {"from_attributes": True}
