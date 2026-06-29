from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.notification import Notification
from app.models.workspace import FileAttachment, Milestone, Task, TaskPriority, TaskStatus, Workspace
from app.schemas.auth import MessageResponse
from app.schemas.workspace import (
    FileAttachmentCreate,
    FileAttachmentResponse,
    MilestoneCreate,
    MilestoneResponse,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
    WorkspaceCreate,
    WorkspaceDetailResponse,
    WorkspaceResponse,
)

router = APIRouter(tags=["Workspaces"])


def _task_response(task: Task) -> TaskResponse:
    return TaskResponse(
        id=task.id,
        workspace_id=task.workspace_id,
        title=task.title,
        description=task.description,
        status=task.status.value,
        priority=task.priority.value,
        assignee_id=task.assignee_id,
        due_date=task.due_date,
        created_at=task.created_at,
    )


async def _get_workspace(db: AsyncSession, workspace_id: UUID, user_id: UUID) -> Workspace:
    result = await db.execute(
        select(Workspace)
        .options(
            selectinload(Workspace.tasks),
            selectinload(Workspace.milestones),
            selectinload(Workspace.files),
        )
        .where(Workspace.id == workspace_id, Workspace.owner_id == user_id)
    )
    ws = result.scalar_one_or_none()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws


@router.get("/workspaces", response_model=dict)
async def list_workspaces(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workspace)
        .where(Workspace.owner_id == current_user.id)
        .order_by(Workspace.created_at.desc())
    )
    items = [WorkspaceResponse.model_validate(w) for w in result.scalars().all()]
    return {"workspaces": items}


@router.post("/workspaces", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    body: WorkspaceCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ws = Workspace(
        name=body.name,
        description=body.description,
        owner_id=current_user.id,
        team_id=body.team_id,
    )
    db.add(ws)
    await db.flush()
    return {"workspace": WorkspaceResponse.model_validate(ws)}


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceDetailResponse)
async def get_workspace(
    workspace_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ws = await _get_workspace(db, workspace_id, current_user.id)
    return WorkspaceDetailResponse(
        id=ws.id,
        name=ws.name,
        description=ws.description,
        owner_id=ws.owner_id,
        team_id=ws.team_id,
        created_at=ws.created_at,
        tasks=[_task_response(t) for t in ws.tasks],
        milestones=[MilestoneResponse.model_validate(m) for m in ws.milestones],
        files=[FileAttachmentResponse.model_validate(f) for f in ws.files],
    )


@router.get("/tasks", response_model=dict)
async def list_tasks(
    current_user: CurrentUser,
    workspace_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    await _get_workspace(db, workspace_id, current_user.id)
    result = await db.execute(select(Task).where(Task.workspace_id == workspace_id))
    return {"tasks": [_task_response(t) for t in result.scalars().all()]}


@router.post("/tasks", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await _get_workspace(db, body.workspace_id, current_user.id)
    status_val = TaskStatus(body.status) if body.status in TaskStatus.__members__ else TaskStatus.todo
    priority_val = (
        TaskPriority(body.priority) if body.priority in TaskPriority.__members__ else TaskPriority.medium
    )
    task = Task(
        workspace_id=body.workspace_id,
        title=body.title,
        description=body.description,
        status=status_val,
        priority=priority_val,
        assignee_id=body.assignee_id,
        due_date=body.due_date,
    )
    db.add(task)
    await db.flush()
    if body.assignee_id and body.assignee_id != current_user.id:
        db.add(
            Notification(
                user_id=body.assignee_id,
                type="task_assigned",
                content=f"{current_user.name} assigned you a task: {body.title}",
            )
        )
    return {"task": _task_response(task)}


@router.patch("/tasks/{task_id}", response_model=dict)
async def update_task(
    task_id: UUID,
    body: TaskUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await _get_workspace(db, task.workspace_id, current_user.id)
    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if body.status is not None and body.status in TaskStatus.__members__:
        task.status = TaskStatus(body.status)
    if body.priority is not None and body.priority in TaskPriority.__members__:
        task.priority = TaskPriority(body.priority)
    if body.assignee_id is not None:
        task.assignee_id = body.assignee_id
    if body.due_date is not None:
        task.due_date = body.due_date
    await db.flush()
    return {"task": _task_response(task)}


@router.delete("/tasks/{task_id}", response_model=MessageResponse)
async def delete_task(
    task_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await _get_workspace(db, task.workspace_id, current_user.id)
    await db.delete(task)
    return MessageResponse(message="Task deleted")


@router.get("/milestones", response_model=dict)
async def list_milestones(
    current_user: CurrentUser,
    workspace_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    await _get_workspace(db, workspace_id, current_user.id)
    result = await db.execute(select(Milestone).where(Milestone.workspace_id == workspace_id))
    return {"milestones": [MilestoneResponse.model_validate(m) for m in result.scalars().all()]}


@router.post("/milestones", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_milestone(
    body: MilestoneCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_workspace(db, body.workspace_id, current_user.id)
    milestone = Milestone(
        workspace_id=body.workspace_id,
        title=body.title,
        description=body.description,
        due_date=body.due_date,
    )
    db.add(milestone)
    await db.flush()
    return {"milestone": MilestoneResponse.model_validate(milestone)}


@router.post("/workspaces/{workspace_id}/files", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_file(
    workspace_id: UUID,
    body: FileAttachmentCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    await _get_workspace(db, workspace_id, current_user.id)
    file_row = FileAttachment(
        workspace_id=workspace_id,
        name=body.name,
        file_url=body.file_url,
        size_bytes=body.size_bytes,
        uploaded_by_id=current_user.id,
    )
    db.add(file_row)
    await db.flush()
    return {"file": FileAttachmentResponse.model_validate(file_row)}
