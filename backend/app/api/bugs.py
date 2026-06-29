from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_
from datetime import datetime
import uuid
from typing import List, Optional

from app.database import get_db
from app.models.bug import Bug, BugStatus, BugPriority, BugSeverity, BugCategory
from app.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/bugs", tags=["bugs"])


@router.post("/create")
async def create_bug(
    bug_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Report a new bug (Any logged-in user)"""
    
    bug = Bug(
        id=uuid.uuid4(),
        title=bug_data.get("title"),
        description=bug_data.get("description"),
        steps_to_reproduce=bug_data.get("steps_to_reproduce"),
        expected_behavior=bug_data.get("expected_behavior"),
        actual_behavior=bug_data.get("actual_behavior"),
        category=bug_data.get("category", "other"),
        severity=bug_data.get("severity", "major"),
        priority=bug_data.get("priority", "medium"),
        browser=bug_data.get("browser"),
        os=bug_data.get("os"),
        device=bug_data.get("device"),
        screen_resolution=bug_data.get("screen_resolution"),
        is_reproducible=bug_data.get("is_reproducible", True),
        reported_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(bug)
    await db.commit()
    await db.refresh(bug)
    
    return {
        "message": "Bug reported successfully!",
        "bug": {
            "id": str(bug.id),
            "title": bug.title,
            "status": bug.status.value,
            "priority": bug.priority.value,
            "severity": bug.severity.value,
            "category": bug.category.value,
            "created_at": bug.created_at.isoformat()
        }
    }


@router.get("/")
async def get_bugs(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all bugs with filters (Admin only)"""
    
    # Check if user is admin
    if current_user.platform_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only admins can view all bugs")
    
    query = select(Bug)
    
    if status:
        query = query.where(Bug.status == status)
    if priority:
        query = query.where(Bug.priority == priority)
    if severity:
        query = query.where(Bug.severity == severity)
    if category:
        query = query.where(Bug.category == category)
    if assigned_to:
        query = query.where(Bug.assigned_to == assigned_to)
    
    query = query.order_by(desc(Bug.created_at))
    
    result = await db.execute(query)
    bugs = result.scalars().all()
    
    return {
        "bugs": [
            {
                "id": str(b.id),
                "title": b.title,
                "description": b.description[:150] + "..." if len(b.description) > 150 else b.description,
                "status": b.status.value,
                "priority": b.priority.value,
                "severity": b.severity.value,
                "category": b.category.value,
                "reported_by": str(b.reported_by),
                "assigned_to": str(b.assigned_to) if b.assigned_to else None,
                "is_reproducible": b.is_reproducible,
                "created_at": b.created_at.isoformat(),
                "updated_at": b.updated_at.isoformat()
            }
            for b in bugs
        ],
        "total": len(bugs)
    }


@router.get("/my-bugs")
async def get_my_bugs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get bugs reported by the current user"""
    
    result = await db.execute(
        select(Bug)
        .where(Bug.reported_by == current_user.id)
        .order_by(desc(Bug.created_at))
    )
    bugs = result.scalars().all()
    
    return {
        "bugs": [
            {
                "id": str(b.id),
                "title": b.title,
                "description": b.description[:150] + "..." if len(b.description) > 150 else b.description,
                "status": b.status.value,
                "priority": b.priority.value,
                "severity": b.severity.value,
                "category": b.category.value,
                "created_at": b.created_at.isoformat()
            }
            for b in bugs
        ],
        "total": len(bugs)
    }


@router.get("/assigned-to-me")
async def get_assigned_bugs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get bugs assigned to the current user"""
    
    result = await db.execute(
        select(Bug)
        .where(Bug.assigned_to == current_user.id)
        .order_by(desc(Bug.created_at))
    )
    bugs = result.scalars().all()
    
    return {
        "bugs": [
            {
                "id": str(b.id),
                "title": b.title,
                "description": b.description[:150] + "..." if len(b.description) > 150 else b.description,
                "status": b.status.value,
                "priority": b.priority.value,
                "severity": b.severity.value,
                "category": b.category.value,
                "reported_by": str(b.reported_by),
                "created_at": b.created_at.isoformat()
            }
            for b in bugs
        ],
        "total": len(bugs)
    }


@router.get("/{bug_id}")
async def get_bug(
    bug_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single bug by ID"""
    
    result = await db.execute(
        select(Bug).where(Bug.id == bug_id)
    )
    bug = result.scalar_one_or_none()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    # Check permission: user can view if they reported it, assigned to it, or are admin
    if (bug.reported_by != current_user.id and 
        bug.assigned_to != current_user.id and 
        current_user.platform_role != "SUPER_ADMIN"):
        raise HTTPException(status_code=403, detail="Not authorized to view this bug")
    
    return {
        "id": str(bug.id),
        "title": bug.title,
        "description": bug.description,
        "steps_to_reproduce": bug.steps_to_reproduce,
        "expected_behavior": bug.expected_behavior,
        "actual_behavior": bug.actual_behavior,
        "status": bug.status.value,
        "priority": bug.priority.value,
        "severity": bug.severity.value,
        "category": bug.category.value,
        "reported_by": str(bug.reported_by),
        "assigned_to": str(bug.assigned_to) if bug.assigned_to else None,
        "browser": bug.browser,
        "os": bug.os,
        "device": bug.device,
        "screen_resolution": bug.screen_resolution,
        "is_reproducible": bug.is_reproducible,
        "screenshot_urls": bug.screenshot_urls or [],
        "attachments": bug.attachments or [],
        "created_at": bug.created_at.isoformat(),
        "updated_at": bug.updated_at.isoformat(),
        "resolved_at": bug.resolved_at.isoformat() if bug.resolved_at else None,
        "resolution_notes": bug.resolution_notes
    }


@router.patch("/{bug_id}/update")
async def update_bug(
    bug_id: str,
    update_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a bug"""
    
    result = await db.execute(
        select(Bug).where(Bug.id == bug_id)
    )
    bug = result.scalar_one_or_none()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    # Check permission
    is_admin = current_user.platform_role == "SUPER_ADMIN"
    is_reporter = bug.reported_by == current_user.id
    is_assignee = bug.assigned_to == current_user.id
    
    # Allow update based on role
    if not (is_admin or is_reporter or is_assignee):
        raise HTTPException(status_code=403, detail="Not authorized to update this bug")
    
    # If user is not admin, they can only update limited fields
    if not is_admin:
        allowed_fields = ["description", "steps_to_reproduce", "expected_behavior", "actual_behavior"]
        for key in update_data:
            if key not in allowed_fields:
                raise HTTPException(status_code=403, detail=f"Cannot update {key} field")
    
    # Update fields
    for key, value in update_data.items():
        if hasattr(bug, key) and value is not None:
            setattr(bug, key, value)
    
    bug.updated_at = datetime.utcnow()
    
    # If status is fixed or closed, set resolved_at
    if bug.status in [BugStatus.fixed, BugStatus.closed]:
        bug.resolved_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(bug)
    
    return {
        "message": "Bug updated successfully",
        "bug": {
            "id": str(bug.id),
            "status": bug.status.value,
            "updated_at": bug.updated_at.isoformat()
        }
    }


@router.post("/{bug_id}/assign")
async def assign_bug(
    bug_id: str,
    assignee_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign a bug to a user (Admin only)"""
    
    if current_user.platform_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only admins can assign bugs")
    
    result = await db.execute(
        select(Bug).where(Bug.id == bug_id)
    )
    bug = result.scalar_one_or_none()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    assignee_result = await db.execute(
        select(User).where(User.id == assignee_id)
    )
    assignee = assignee_result.scalar_one_or_none()
    
    if not assignee:
        raise HTTPException(status_code=404, detail="User not found")
    
    bug.assigned_to = assignee_id
    bug.status = BugStatus.in_progress
    bug.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "message": f"Bug assigned to {assignee.name}",
        "bug": {
            "id": str(bug.id),
            "assigned_to": str(bug.assigned_to),
            "status": bug.status.value
        }
    }


@router.post("/{bug_id}/resolve")
async def resolve_bug(
    bug_id: str,
    resolution_notes: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a bug as resolved"""
    
    result = await db.execute(
        select(Bug).where(Bug.id == bug_id)
    )
    bug = result.scalar_one_or_none()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    # Check permission: assignee or admin can resolve
    if bug.assigned_to != current_user.id and current_user.platform_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to resolve this bug")
    
    bug.status = BugStatus.fixed
    bug.resolved_at = datetime.utcnow()
    bug.resolution_notes = resolution_notes
    bug.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "message": "Bug resolved successfully",
        "bug": {
            "id": str(bug.id),
            "status": bug.status.value,
            "resolved_at": bug.resolved_at.isoformat()
        }
    }


@router.post("/{bug_id}/verify")
async def verify_bug(
    bug_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify a fixed bug (Admin or reporter can verify)"""
    
    result = await db.execute(
        select(Bug).where(Bug.id == bug_id)
    )
    bug = result.scalar_one_or_none()
    
    if not bug:
        raise HTTPException(status_code=404, detail="Bug not found")
    
    # Check permission: reporter or admin can verify
    if bug.reported_by != current_user.id and current_user.platform_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only reporter or admin can verify this bug")
    
    if bug.status != BugStatus.fixed:
        raise HTTPException(status_code=400, detail="Bug must be fixed first")
    
    bug.status = BugStatus.verified
    bug.verified_at = datetime.utcnow()
    bug.verified_by = current_user.id
    bug.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "message": "Bug verified successfully",
        "bug": {
            "id": str(bug.id),
            "status": bug.status.value,
            "verified_at": bug.verified_at.isoformat()
        }
    }