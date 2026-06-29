from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.broadcast import AdminBroadcast
from app.models.notification import Notification
from app.models.push_token import PushToken
from app.schemas.auth import MessageResponse
from app.schemas.broadcast import PushTokenRegister
from app.schemas.notification import NotificationResponse
from app.services.push_notification_service import (
    get_vapid_subscription_version,
    purge_stale_push_subscriptions,
    validate_vapid_key_pair,
    validate_vapid_private_key,
)

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=dict)
async def get_notifications(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    items = [NotificationResponse.model_validate(n) for n in result.scalars().all()]
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
    if not notification.opened_at:
        notification.opened_at = datetime.now(timezone.utc)
        if notification.broadcast_id:
            broadcast = await db.get(AdminBroadcast, notification.broadcast_id)
            if broadcast:
                broadcast.notification_open_count = (broadcast.notification_open_count or 0) + 1
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


@router.post("/push-token", response_model=MessageResponse)
async def register_push_token(
    body: PushTokenRegister,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if body.platform == "web" and not (body.subscription_json or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Web push requires a PushManager subscription",
        )

    subscription_version = get_vapid_subscription_version()
    if body.platform == "web":
        await purge_stale_push_subscriptions(db, user_id=current_user.id)
        await db.execute(
            delete(PushToken).where(
                PushToken.user_id == current_user.id,
                PushToken.platform == "web",
                PushToken.token != body.token,
            )
        )

    existing = await db.execute(
        select(PushToken).where(
            PushToken.user_id == current_user.id,
            PushToken.platform == body.platform,
            PushToken.token == body.token,
        )
    )
    token_row = existing.scalar_one_or_none()
    if token_row:
        token_row.subscription_json = body.subscription_json
        token_row.subscription_version = subscription_version
        token_row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(
            PushToken(
                user_id=current_user.id,
                platform=body.platform,
                token=body.token,
                subscription_json=body.subscription_json,
                subscription_version=subscription_version,
            )
        )
    await db.flush()
    logger.info(
        "Push token registered user=%s platform=%s version=%s endpoint_prefix=%s subscription_bytes=%s",
        current_user.id,
        body.platform,
        subscription_version,
        (body.token or "")[:72],
        len(body.subscription_json or ""),
    )
    return MessageResponse(message="Push token registered")


@router.delete("/push-token", response_model=MessageResponse)
async def unregister_push_token(
    body: PushTokenRegister,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PushToken).where(
            PushToken.user_id == current_user.id,
            PushToken.platform == body.platform,
            PushToken.token == body.token,
        )
    )
    token_row = result.scalar_one_or_none()
    if token_row:
        await db.delete(token_row)
    return MessageResponse(message="Push token removed")


@router.get("/push-config", response_model=dict)
async def get_push_config(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    public_key = (settings.VAPID_PUBLIC_KEY or "").strip()
    private_key = (settings.VAPID_PRIVATE_KEY or "").strip()
    private_valid, private_error = validate_vapid_private_key(private_key)
    pair_valid, pair_error = validate_vapid_key_pair(public_key, private_key)
    web_push_enabled = bool(public_key and private_key and private_valid and pair_valid)
    subscription_version = get_vapid_subscription_version()

    if web_push_enabled:
        purged = await purge_stale_push_subscriptions(db, user_id=current_user.id)
        if purged:
            logger.warning(
                "Removed %s stale push subscription(s) for user=%s on push-config",
                purged,
                current_user.id,
            )

    if private_key and not private_valid:
        logger.error("VAPID_PRIVATE_KEY is configured but invalid: %s", private_error)
    if private_key and private_valid and not pair_valid:
        logger.error("VAPID key pair mismatch: %s", pair_error)
    return {
        "vapid_public_key": public_key,
        "web_push_enabled": web_push_enabled,
        "vapid_private_key_valid": private_valid,
        "vapid_key_pair_valid": pair_valid,
        "vapid_error": private_error or pair_error or None,
        "subscription_version": subscription_version,
        "resubscribe_required": web_push_enabled and subscription_version is not None,
    }
