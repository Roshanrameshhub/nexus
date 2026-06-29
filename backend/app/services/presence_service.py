import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.user import User
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

INACTIVITY_SECONDS = 300
_CHECK_INTERVAL_SECONDS = 60


async def mark_user_online(user_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return
        user.is_online = True
        await db.commit()


async def mark_user_offline(user_id: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return None
        user.is_online = False
        user.last_seen_at = now
        await db.commit()
        return now


async def broadcast_presence(user_id: str, is_online: bool, last_seen_at: datetime | None) -> None:
    last_seen_value = last_seen_at.isoformat() if last_seen_at else None
    await manager.broadcast_presence(user_id, is_online, last_seen_value)


async def handle_presence_connect(user_id: str) -> None:
    manager.touch_heartbeat(user_id)
    await mark_user_online(user_id)
    await broadcast_presence(user_id, True, None)


async def handle_presence_heartbeat(user_id: str) -> None:
    manager.touch_heartbeat(user_id)
    was_online = user_id in manager.presence_connections
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(user_id)))
        user = result.scalar_one_or_none()
        if not user:
            return
        became_online = not user.is_online
        user.is_online = True
        await db.commit()
    if became_online:
        await broadcast_presence(user_id, True, None)


async def handle_presence_disconnect(user_id: str) -> None:
    if user_id in manager.presence_connections:
        return
    last_seen = await mark_user_offline(user_id)
    await broadcast_presence(user_id, False, last_seen)


async def handle_going_offline(user_id: str) -> None:
    manager.last_heartbeat.pop(user_id, None)
    manager.presence_connections.pop(user_id, None)
    last_seen = await mark_user_offline(user_id)
    await broadcast_presence(user_id, False, last_seen)


async def process_inactive_users() -> None:
    stale_user_ids = manager.get_stale_presence_users(INACTIVITY_SECONDS)
    for user_id in stale_user_ids:
        last_seen = await mark_user_offline(user_id)
        await broadcast_presence(user_id, False, last_seen)
        logger.debug("Marked user %s offline due to inactivity", user_id)


async def run_inactivity_checker() -> None:
    while True:
        try:
            await asyncio.sleep(_CHECK_INTERVAL_SECONDS)
            await process_inactive_users()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Presence inactivity checker failed")
