from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import secrets
import string
import uuid
from datetime import datetime

from app.database import get_db
from app.models.school import School, Classroom, Homework, HomeworkView
from app.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/schools", tags=["schools"])


# ─── SCHOOL ENDPOINTS ────────────────────────────────────────────────

@router.get("/my-schools")
async def get_my_schools(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all schools where the user is admin"""
    result = await db.execute(
        select(School).where(School.admin_id == current_user.id)
    )
    schools = result.scalars().all()
    
    return {
        "schools": [
            {
                "id": str(s.id),
                "name": s.name,
                "address": s.address,
                "verification_status": s.verification_status,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in schools
        ]
    }


@router.post("/create")
async def create_school(
    school: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new school"""
    
    # Check if user already owns a school
    existing = await db.execute(
        select(School).where(School.admin_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already own a school")
    
    db_school = School(
        id=uuid.uuid4(),
        name=school.get("name"),
        address=school.get("address", ""),
        admin_id=current_user.id,
        verification_status="pending",
        created_at=datetime.utcnow()
    )
    
    db.add(db_school)
    await db.commit()
    await db.refresh(db_school)
    
    return {
        "message": "School created successfully",
        "school": {
            "id": str(db_school.id),
            "name": db_school.name,
            "address": db_school.address,
            "verification_status": db_school.verification_status
        }
    }


@router.get("/{school_id}")
async def get_school(
    school_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single school by ID"""
    result = await db.execute(
        select(School).where(School.id == school_id)
    )
    school = result.scalar_one_or_none()
    
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    return {
        "id": str(school.id),
        "name": school.name,
        "address": school.address,
        "verification_status": school.verification_status,
        "created_at": school.created_at.isoformat() if school.created_at else None
    }


# ─── CLASSROOM ENDPOINTS ─────────────────────────────────────────────

@router.get("/{school_id}/classrooms")
async def get_classrooms(
    school_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all classrooms in a school"""
    result = await db.execute(
        select(Classroom).where(Classroom.school_id == school_id)
    )
    classrooms = result.scalars().all()
    
    return {
        "classrooms": [
            {
                "id": str(c.id),
                "name": c.name,
                "grade": c.grade,
                "section": c.section,
                "join_code": c.join_code,
                "teacher_id": str(c.teacher_id),
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in classrooms
        ]
    }


@router.post("/{school_id}/classrooms/create")
async def create_classroom(
    school_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new classroom in a school"""
    
    # Check if user is admin of this school
    school_result = await db.execute(
        select(School).where(School.id == school_id)
    )
    school = school_result.scalar_one_or_none()
    
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    if school.admin_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to create classrooms in this school")
    
    # Generate unique join code
    join_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    classroom = Classroom(
        id=uuid.uuid4(),
        name=data.get("name"),
        school_id=school_id,
        teacher_id=current_user.id,
        grade=data.get("grade"),
        section=data.get("section"),
        join_code=join_code,
        created_at=datetime.utcnow()
    )
    
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)
    
    return {
        "message": "Classroom created successfully",
        "classroom": {
            "id": str(classroom.id),
            "name": classroom.name,
            "grade": classroom.grade,
            "section": classroom.section,
            "join_code": classroom.join_code,
            "teacher_id": str(classroom.teacher_id)
        }
    }


@router.get("/classrooms/{classroom_id}")
async def get_classroom(
    classroom_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single classroom by ID"""
    result = await db.execute(
        select(Classroom).where(Classroom.id == classroom_id)
    )
    classroom = result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    return {
        "id": str(classroom.id),
        "name": classroom.name,
        "school_id": str(classroom.school_id),
        "teacher_id": str(classroom.teacher_id),
        "grade": classroom.grade,
        "section": classroom.section,
        "join_code": classroom.join_code,
        "created_at": classroom.created_at.isoformat() if classroom.created_at else None
    }


# ─── HOMEWORK ENDPOINTS ──────────────────────────────────────────────

@router.get("/{school_id}/homework")
async def get_homework(
    school_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all homework in a school"""
    
    # Get all classrooms in the school
    classrooms_result = await db.execute(
        select(Classroom.id).where(Classroom.school_id == school_id)
    )
    classroom_ids = [str(row[0]) for row in classrooms_result.all()]
    
    if not classroom_ids:
        return {"homework": []}
    
    # Get homework for these classrooms
    result = await db.execute(
        select(Homework).where(Homework.classroom_id.in_(classroom_ids))
    )
    homework = result.scalars().all()
    
    return {
        "homework": [
            {
                "id": str(h.id),
                "title": h.title,
                "description": h.description,
                "due_date": h.due_date.isoformat() if h.due_date else None,
                "created_at": h.created_at.isoformat() if h.created_at else None,
                "classroom_id": str(h.classroom_id),
                "teacher_id": str(h.teacher_id)
            }
            for h in homework
        ]
    }


@router.post("/homework/create")
async def create_homework(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create homework for a classroom"""
    
    # Verify classroom exists and user is teacher/admin
    classroom_result = await db.execute(
        select(Classroom).where(Classroom.id == data.get("classroom_id"))
    )
    classroom = classroom_result.scalar_one_or_none()
    
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    if classroom.teacher_id != current_user.id:
        # Check if user is school admin
        school_result = await db.execute(
            select(School).where(School.id == classroom.school_id)
        )
        school = school_result.scalar_one_or_none()
        if not school or school.admin_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to post homework in this classroom")
    
    homework = Homework(
        id=uuid.uuid4(),
        title=data.get("title"),
        description=data.get("description", ""),
        classroom_id=data.get("classroom_id"),
        teacher_id=current_user.id,
        due_date=data.get("due_date"),
        attachments=data.get("attachments", []),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(homework)
    await db.commit()
    await db.refresh(homework)
    
    return {
        "message": "Homework posted successfully",
        "homework": {
            "id": str(homework.id),
            "title": homework.title,
            "description": homework.description,
            "due_date": homework.due_date.isoformat() if homework.due_date else None,
            "classroom_id": str(homework.classroom_id),
            "teacher_id": str(homework.teacher_id),
            "created_at": homework.created_at.isoformat() if homework.created_at else None
        }
    }


@router.get("/homework/{homework_id}")
async def get_homework_item(
    homework_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single homework by ID"""
    result = await db.execute(
        select(Homework).where(Homework.id == homework_id)
    )
    homework = result.scalar_one_or_none()
    
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")
    
    return {
        "id": str(homework.id),
        "title": homework.title,
        "description": homework.description,
        "due_date": homework.due_date.isoformat() if homework.due_date else None,
        "classroom_id": str(homework.classroom_id),
        "teacher_id": str(homework.teacher_id),
        "created_at": homework.created_at.isoformat() if homework.created_at else None,
        "updated_at": homework.updated_at.isoformat() if homework.updated_at else None
    }


# ─── STUDENT TRACKING ENDPOINTS ──────────────────────────────────────

@router.get("/{school_id}/students/tracking")
async def get_student_tracking(
    school_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get student engagement tracking for a school"""
    
    # Get all classrooms in the school
    classrooms_result = await db.execute(
        select(Classroom.id).where(Classroom.school_id == school_id)
    )
    classroom_ids = [str(row[0]) for row in classrooms_result.all()]
    
    if not classroom_ids:
        return {"students": []}
    
    # Get all homework in these classrooms
    homework_result = await db.execute(
        select(Homework.id).where(Homework.classroom_id.in_(classroom_ids))
    )
    homework_ids = [str(row[0]) for row in homework_result.all()]
    
    if not homework_ids:
        return {"students": []}
    
    # Get views for these homework
    views_result = await db.execute(
        select(HomeworkView).where(HomeworkView.homework_id.in_(homework_ids))
    )
    views = views_result.scalars().all()
    
    # Group by student
    student_data = {}
    for view in views:
        student_id = str(view.student_id)
        if student_id not in student_data:
            student_data[student_id] = {
                "student_id": student_id,
                "homework_viewed": 0,
                "total_time_spent": 0,
                "last_viewed": view.last_viewed.isoformat() if view.last_viewed else None
            }
        student_data[student_id]["homework_viewed"] += 1
        student_data[student_id]["total_time_spent"] += view.time_spent or 0
        if view.last_viewed and (not student_data[student_id]["last_viewed"] or view.last_viewed > student_data[student_id]["last_viewed"]):
            student_data[student_id]["last_viewed"] = view.last_viewed.isoformat()
    
    return {"students": list(student_data.values())}


@router.post("/homework/{homework_id}/track")
async def track_homework_view(
    homework_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Track when a student views homework"""
    
    # Check if homework exists
    homework_result = await db.execute(
        select(Homework).where(Homework.id == homework_id)
    )
    homework = homework_result.scalar_one_or_none()
    
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")
    
    # Check or create view record
    view_result = await db.execute(
        select(HomeworkView).where(
            HomeworkView.homework_id == homework_id,
            HomeworkView.student_id == current_user.id
        )
    )
    view = view_result.scalar_one_or_none()
    
    if view:
        view.view_count = (view.view_count or 0) + 1
        view.last_viewed = datetime.utcnow()
        view.time_spent = (view.time_spent or 0) + 30  # Assume 30 seconds per view
    else:
        view = HomeworkView(
            id=uuid.uuid4(),
            homework_id=homework_id,
            student_id=current_user.id,
            view_count=1,
            time_spent=30,
            viewed_at=datetime.utcnow(),
            last_viewed=datetime.utcnow()
        )
        db.add(view)
    
    await db.commit()
    
    return {"message": "View tracked successfully"}


@router.get("/homework/{homework_id}/views")
async def get_homework_views(
    homework_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all views for a homework (teacher only)"""
    
    # Check if homework exists
    homework_result = await db.execute(
        select(Homework).where(Homework.id == homework_id)
    )
    homework = homework_result.scalar_one_or_none()
    
    if not homework:
        raise HTTPException(status_code=404, detail="Homework not found")
    
    # Verify teacher
    if homework.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all views
    views_result = await db.execute(
        select(HomeworkView).where(HomeworkView.homework_id == homework_id)
    )
    views = views_result.scalars().all()
    
    return {
        "homework_id": str(homework_id),
        "homework_title": homework.title,
        "total_views": len(views),
        "views": [
            {
                "student_id": str(v.student_id),
                "view_count": v.view_count,
                "time_spent": v.time_spent,
                "viewed_at": v.viewed_at.isoformat() if v.viewed_at else None,
                "last_viewed": v.last_viewed.isoformat() if v.last_viewed else None
            }
            for v in views
        ]
    }