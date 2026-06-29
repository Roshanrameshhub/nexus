from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class BugBase(BaseModel):
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    priority: str = "medium"
    environment: Optional[str] = None
    browser: Optional[str] = None
    os: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    is_reproducible: bool = True

class BugCreate(BugBase):
    pass

class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[UUID] = None
    steps_to_reproduce: Optional[str] = None
    resolution_notes: Optional[str] = None
    is_reproducible: Optional[bool] = None

class BugResponse(BugBase):
    id: UUID
    reported_by: UUID
    assigned_to: Optional[UUID] = None
    status: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    screenshot_url: Optional[str] = None
    
    class Config:
        from_attributes = True