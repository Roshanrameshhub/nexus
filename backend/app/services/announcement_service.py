from datetime import datetime, timezone
import json
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_console import AdminAnnouncement, AnnouncementDismissal
from app.models.user import User, UserRole
from app.utils.country import normalize_country


def audience_matches(user: User, audience: str, custom_audience: Optional[str]) -> bool:
    if audience == "all":
        return True
    if audience == "verified":
        return bool(getattr(user, "is_verified", False))
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if audience == "students":
        return role == UserRole.student.value
    if audience == "developers":
        return role == UserRole.developer.value
    if audience == "founders":
        return role == UserRole.founder.value
    if audience == "executives":
        return role == UserRole.executive.value
    if audience == "investors":
        return role == UserRole.investor.value
    if audience == "mentors":
        return role == UserRole.mentor.value
    if audience == "recruiters":
        return role == "recruiter"
    if audience == "custom" and custom_audience:
        try:
            data = json.loads(custom_audience)
            if isinstance(data, list):
                if str(user.id) in [str(x) for x in data]:
                    return True
                if role in [str(x).lower() for x in data]:
                    return True
        except json.JSONDecodeError:
            pass
    return False


def broadcast_audience_matches(
    user: User,
    audience: str,
    custom_audience: Optional[str],
    target_country: Optional[str] = None,
    target_city: Optional[str] = None,
) -> bool:
    if not audience_matches(user, audience, custom_audience):
        return False
    if target_country:
        user_country = normalize_country(user.country or "")
        wanted = normalize_country(target_country)
        if not wanted or user_country != wanted:
            return False
    if target_city:
        user_city = (user.city or "").strip().lower()
        wanted_city = target_city.strip().lower()
        if not wanted_city or user_city != wanted_city:
            return False
    return True


def announcement_is_live(announcement: AdminAnnouncement, now: Optional[datetime] = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if announcement.publish_at and announcement.publish_at > now:
        return False
    if announcement.expires_at and announcement.expires_at <= now:
        return False
    return True


ANNOUNCEMENT_PRIORITY_WEIGHT = {
    "critical": 3,
    "high": 2,
    "medium": 1,
    "low": 0,
}


def sort_announcements(items: list[AdminAnnouncement]) -> list[AdminAnnouncement]:
    return sorted(
        items,
        key=lambda ann: (
            -ANNOUNCEMENT_PRIORITY_WEIGHT.get((ann.priority or "medium").lower(), 1),
            -(ann.created_at.timestamp() if ann.created_at else 0),
        ),
    )


async def get_user_announcements(db: AsyncSession, user: User) -> list[AdminAnnouncement]:
    now = datetime.now(timezone.utc)
    dismissed_ids = (
        await db.execute(
            select(AnnouncementDismissal.announcement_id).where(AnnouncementDismissal.user_id == user.id)
        )
    ).scalars().all()
    dismissed_set = set(dismissed_ids)

    result = await db.execute(
        select(AdminAnnouncement)
        .options(selectinload(AdminAnnouncement.created_by))
        .order_by(AdminAnnouncement.created_at.desc())
    )
    items: list[AdminAnnouncement] = []
    for ann in result.scalars().all():
        if not announcement_is_live(ann, now):
            continue
        if getattr(ann, "show_in_dashboard", True) is False:
            continue
        if not broadcast_audience_matches(
            user, ann.audience, ann.custom_audience, getattr(ann, "target_country", None), getattr(ann, "target_city", None)
        ):
            continue
        if ann.id in dismissed_set and ann.priority in ("low", "medium"):
            continue
        items.append(ann)
    return sort_announcements(items)
