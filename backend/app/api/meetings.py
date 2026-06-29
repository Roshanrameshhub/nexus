from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import secrets
import string
import uuid

from app.database import get_db
from app.models.meeting import Meeting
from app.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/")
async def list_meetings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Meeting).where(Meeting.host_id == current_user.id)
    )
    meetings = result.scalars().all()

    return {
        "meetings": [
            {
                "id": str(m.id),
                "title": m.title,
                "description": m.description,
                "start_time": m.start_time.isoformat() if m.start_time else None,
                "end_time": m.end_time.isoformat() if m.end_time else None,
                "status": m.status.value if m.status else "scheduled",
                "meeting_link": m.meeting_link,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in meetings
        ]
    }


@router.get("/debug")
async def debug_meetings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Meeting))
    all_meetings = result.scalars().all()

    return {
        "user_id": str(current_user.id),
        "total_meetings": len(all_meetings),
        "meetings_detail": [
            {
                "id": str(m.id),
                "host_id": str(m.host_id),
                "match": m.host_id == current_user.id
            }
            for m in all_meetings
        ]
    }


@router.post("/create")
async def create_meeting(
    meeting: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    meeting_link = ''.join(
        secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12)
    )

    db_meeting = Meeting(
        id=uuid.uuid4(),
        title=meeting.get("title", "New Meeting"),
        description=meeting.get("description", ""),
        host_id=current_user.id,
        speaker_id=meeting.get("speaker_id", current_user.id),
        start_time=datetime.now(),
        end_time=None,
        max_attendees=meeting.get("max_attendees", 100),
        meeting_link=meeting_link
    )

    db.add(db_meeting)
    await db.commit()
    await db.refresh(db_meeting)

    return {
        "message": "Meeting created",
        "meeting": {
            "id": str(db_meeting.id),
            "title": db_meeting.title,
            "meeting_link": db_meeting.meeting_link,
            "join_url": f"/meeting/{str(db_meeting.id)}?link={meeting_link}"
        }
    }