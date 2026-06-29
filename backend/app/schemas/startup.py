from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class StartupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    tags: List[str] = []
    logo_url: Optional[str] = None
    website: Optional[str] = None


class StartupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    tags: Optional[List[str]] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None


class PositionResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    type: Optional[str] = None
    skills_required: List[str] = []
    experience_required: Optional[str] = None
    compensation: Optional[str] = None
    equity: Optional[str] = None
    contact_email: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StartupResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    tags: List[str] = []
    logo_url: Optional[str] = None
    website: Optional[str] = None
    creator_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class StartupListResponse(BaseModel):
    startups: List[StartupResponse]
    page: int
    limit: int
    total: int
    has_more: bool
