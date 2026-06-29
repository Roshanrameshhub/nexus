from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    team_id: Optional[UUID] = None


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    owner_id: UUID
    team_id: Optional[UUID] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    workspace_id: UUID
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    assignee_id: Optional[UUID] = None
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[UUID] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    assignee_id: Optional[UUID] = None
    due_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MilestoneCreate(BaseModel):
    workspace_id: UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None


class MilestoneResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FileAttachmentCreate(BaseModel):
    name: str
    file_url: str
    size_bytes: int = 0


class FileAttachmentResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    file_url: str
    size_bytes: int
    uploaded_by_id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceDetailResponse(WorkspaceResponse):
    tasks: List[TaskResponse] = []
    milestones: List[MilestoneResponse] = []
    files: List[FileAttachmentResponse] = []
