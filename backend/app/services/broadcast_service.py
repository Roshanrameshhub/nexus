from __future__ import annotations

import logging

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_console import AdminAnnouncement
from app.models.broadcast import AdminBroadcast
from app.models.notification import Notification
from app.models.post import Post, PostType
from app.models.push_token import PushToken
from app.models.user import User, UserRole
from app.services.announcement_service import broadcast_audience_matches
from app.services.push_notification_service import PushSendResult, send_push_to_users

logger = logging.getLogger(__name__)


def user_matches_broadcast(
    user: User,
    audience: str,
    custom_audience: Optional[str],
    target_country: Optional[str],
    target_city: Optional[str],
) -> bool:
    return broadcast_audience_matches(user, audience, custom_audience, target_country, target_city)


async def resolve_target_users(
    db: AsyncSession,
    audience: str,
    custom_audience: Optional[str] = None,
    target_country: Optional[str] = None,
    target_city: Optional[str] = None,
) -> list[User]:
    result = await db.execute(
        select(User).where(User.is_banned.is_(False), User.is_suspended.is_(False))
    )
    users = result.scalars().all()
    return [
        u
        for u in users
        if user_matches_broadcast(u, audience, custom_audience, target_country, target_city)
    ]


def _notification_content(broadcast_type: str, title: str, body: str) -> tuple[str, str]:
    if broadcast_type == "admin_post":
        return ("official_post", f"📌 Official RConnectX Update\n{title}\n\n{body[:200]}")
    if broadcast_type == "notification":
        return ("admin_notification", f"{title}\n\n{body[:200]}")
    return ("announcement", f"📢 New Announcement\n{title}\n\n{body[:200]}")


def _push_title_body(broadcast_type: str, title: str, content: str) -> tuple[str, str]:
    if broadcast_type == "announcement":
        return "📢 New Announcement", f"{title}\n\n{content[:240]}"
    if broadcast_type == "admin_post":
        return "📌 Official RConnectX Update", f"{title}\n\n{content[:240]}"
    return title, content[:240]


def push_result_payload(result: PushSendResult | None) -> dict:
    if result is None:
        return {}
    return {
        "push_delivered": result.delivered,
        "push_tokens_found": result.tokens_found,
        "push_tokens_attempted": result.tokens_attempted,
        "push_tokens_failed": result.tokens_failed,
        "push_tokens_skipped": result.tokens_skipped,
        "push_tokens_removed": result.tokens_removed,
        "push_skip_reason": result.skip_reason,
        "push_failure_samples": result.failure_details[:5],
    }


async def dispatch_broadcast(
    db: AsyncSession,
    broadcast: AdminBroadcast,
    *,
    link_url: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
) -> tuple[int, PushSendResult | None]:
    users = await resolve_target_users(
        db,
        broadcast.audience,
        broadcast.custom_audience,
        broadcast.target_country,
        broadcast.target_city,
    )
    notif_type, content = _notification_content(broadcast.broadcast_type, broadcast.title, broadcast.content)
    delivered_push = 0
    push_result: PushSendResult | None = None

    if broadcast.send_in_app_notification or broadcast.show_in_notification_center:
        for user in users:
            db.add(
                Notification(
                    user_id=user.id,
                    type=notif_type,
                    content=content,
                    link_url=link_url,
                    target_type=target_type,
                    target_id=target_id,
                    broadcast_id=broadcast.id,
                )
            )

    if broadcast.send_browser_push or broadcast.send_mobile_push:
        logger.warning(
            "dispatch_broadcast push enabled broadcast=%s type=%s send_browser_push=%s send_mobile_push=%s recipients=%s",
            broadcast.id,
            broadcast.broadcast_type,
            broadcast.send_browser_push,
            broadcast.send_mobile_push,
            len(users),
        )
        push_title, push_body = _push_title_body(
            broadcast.broadcast_type, broadcast.title, broadcast.content
        )
        platforms: list[str] = []
        if broadcast.send_browser_push:
            platforms.append("web")
        if broadcast.send_mobile_push:
            platforms.extend(["android", "ios"])
        push_result = await send_push_to_users(
            db,
            [u.id for u in users],
            title=push_title,
            body=push_body,
            link_url=link_url,
            platforms=platforms,
        )
        delivered_push = push_result.delivered
        broadcast.push_delivery_count = (broadcast.push_delivery_count or 0) + delivered_push
        if broadcast.send_browser_push and delivered_push == 0:
            logger.warning(
                "Browser push delivery count is 0 for broadcast=%s reason=%s tokens_found=%s recipients=%s failures=%s",
                broadcast.id,
                push_result.skip_reason,
                push_result.tokens_found,
                push_result.recipient_user_count,
                push_result.failure_details[:3],
            )

    await db.flush()
    return len(users), push_result


async def create_broadcast_record(
    db: AsyncSession,
    *,
    broadcast_type: str,
    title: str,
    content: str,
    audience: str,
    custom_audience: Optional[str],
    target_country: Optional[str],
    target_city: Optional[str],
    show_in_dashboard: bool,
    show_in_notification_center: bool,
    send_in_app_notification: bool,
    send_browser_push: bool,
    send_mobile_push: bool,
    created_by_id: UUID,
    announcement_id: Optional[UUID] = None,
    post_id: Optional[UUID] = None,
) -> AdminBroadcast:
    broadcast = AdminBroadcast(
        broadcast_type=broadcast_type,
        title=title,
        content=content,
        audience=audience,
        custom_audience=custom_audience,
        target_country=target_country,
        target_city=target_city,
        show_in_dashboard=show_in_dashboard,
        show_in_notification_center=show_in_notification_center,
        send_in_app_notification=send_in_app_notification,
        send_browser_push=send_browser_push,
        send_mobile_push=send_mobile_push,
        announcement_id=announcement_id,
        post_id=post_id,
        created_by_id=created_by_id,
    )
    db.add(broadcast)
    await db.flush()
    return broadcast


async def publish_announcement_broadcast(
    db: AsyncSession,
    announcement: AdminAnnouncement,
    broadcast: AdminBroadcast,
) -> int:
    link = announcement.cta_url or f"/dashboard?announcement={announcement.id}"
    recipients, _push = await dispatch_broadcast(
        db,
        broadcast,
        link_url=link,
        target_type="announcement",
        target_id=str(announcement.id),
    )
    return recipients


async def publish_admin_post(
    db: AsyncSession,
    admin: User,
    *,
    content: str,
    post_type: str,
    media: Optional[list[str]],
    hashtags: Optional[list[str]],
    poll_details: Optional[dict],
    official_label: str,
    show_in_announcements_hub: bool,
    audience: str,
    custom_audience: Optional[str],
    target_country: Optional[str],
    target_city: Optional[str],
    show_in_dashboard: bool,
    show_in_notification_center: bool,
    send_in_app_notification: bool,
    send_browser_push: bool,
    send_mobile_push: bool,
    title: Optional[str] = None,
) -> tuple[Post, AdminBroadcast, int, PushSendResult | None]:
    resolved_type = post_type or "text"
    try:
        enum_type = PostType(resolved_type)
    except ValueError:
        enum_type = PostType.text

    broadcast = await create_broadcast_record(
        db,
        broadcast_type="admin_post",
        title=title or content[:80],
        content=content,
        audience=audience,
        custom_audience=custom_audience,
        target_country=target_country,
        target_city=target_city,
        show_in_dashboard=show_in_dashboard,
        show_in_notification_center=show_in_notification_center,
        send_in_app_notification=send_in_app_notification,
        send_browser_push=send_browser_push,
        send_mobile_push=send_mobile_push,
        created_by_id=admin.id,
    )

    post = Post(
        user_id=admin.id,
        content=content,
        post_type=enum_type,
        media=media or [],
        image_url=media[0] if media else None,
        hashtags=hashtags or [],
        poll_details=poll_details,
        is_official=True,
        official_label=official_label or "RConnectX Team",
        show_in_announcements_hub=show_in_announcements_hub,
        broadcast_id=broadcast.id,
    )
    db.add(post)
    await db.flush()
    broadcast.post_id = post.id
    await db.refresh(post, ["author"])

    recipients, push_result = await dispatch_broadcast(
        db,
        broadcast,
        link_url=f"/posts/{post.id}",
        target_type="post",
        target_id=str(post.id),
    )
    return post, broadcast, recipients, push_result


async def publish_standalone_notification(
    db: AsyncSession,
    admin: User,
    *,
    title: str,
    content: str,
    link_url: Optional[str],
    audience: str,
    custom_audience: Optional[str],
    target_country: Optional[str],
    target_city: Optional[str],
    show_in_dashboard: bool,
    show_in_notification_center: bool,
    send_in_app_notification: bool,
    send_browser_push: bool,
    send_mobile_push: bool,
) -> tuple[AdminBroadcast, int, PushSendResult | None]:
    broadcast = await create_broadcast_record(
        db,
        broadcast_type="notification",
        title=title,
        content=content,
        audience=audience,
        custom_audience=custom_audience,
        target_country=target_country,
        target_city=target_city,
        show_in_dashboard=show_in_dashboard,
        show_in_notification_center=show_in_notification_center,
        send_in_app_notification=send_in_app_notification,
        send_browser_push=send_browser_push,
        send_mobile_push=send_mobile_push,
        created_by_id=admin.id,
    )
    recipients, push_result = await dispatch_broadcast(
        db,
        broadcast,
        link_url=link_url or "/notifications",
        target_type="broadcast",
        target_id=str(broadcast.id),
    )
    return broadcast, recipients, push_result
