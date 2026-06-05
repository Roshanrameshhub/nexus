from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.notification import Notification
from app.schemas.auth import MessageResponse
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=dict)
async def get_notifications(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    items = [
        NotificationResponse(
            id=n.id,
            type=n.type,
            content=n.content,
            read_status=n.read_status,
            created_at=n.created_at,
        )
        for n in result.scalars().all()
    ]
    return {"notifications": items}


@router.patch("/{notification_id}/read", response_model=dict)
async def mark_as_read(
    notification_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    notification.read_status = True
    await db.flush()
    return {"notification": NotificationResponse.model_validate(notification)}


@router.patch("/read-all", response_model=MessageResponse)
async def mark_all_read(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_status.is_(False))
        .values(read_status=True)
    )
    return MessageResponse(message="All notifications marked as read")
