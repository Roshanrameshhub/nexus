from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.admin_console import ContentReport, ReportStatus
from app.models.post import Post

ContentTab = Literal[
    "recent",
    "trending_week",
    "trending_month",
    "most_discussed",
    "most_liked",
    "reported",
    "pinned",
]

MAX_PINNED_POSTS = 10


def trending_score(post: Post) -> int:
    likes = post.likes_count or 0
    comments = post.comments_count or 0
    shares = post.shares_count or 0
    return (likes * 2) + (comments * 5) + (shares * 10)


def pin_expiry_from_days(days: int | None) -> datetime | None:
    if days is None or days <= 0:
        return None
    return datetime.now(timezone.utc) + timedelta(days=days)


async def unpin_expired_posts(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Post).where(
            Post.is_pinned.is_(True),
            Post.pin_expires_at.isnot(None),
            Post.pin_expires_at < now,
        )
    )
    for post in result.scalars().all():
        post.is_pinned = False
        post.pin_order = None
        post.pinned_at = None
        post.pinned_by_id = None
        post.pin_expires_at = None


def _week_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=7)


def _month_cutoff() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=30)


def _recent_engagement_filter(cutoff: datetime):
    """Posts in window OR with engagement counts suggesting activity in window."""
    return or_(
        Post.created_at >= cutoff,
        and_(Post.comments_count > 0, Post.created_at >= cutoff - timedelta(days=7)),
        and_(Post.likes_count > 0, Post.created_at >= cutoff - timedelta(days=7)),
        and_(Post.shares_count > 0, Post.created_at >= cutoff - timedelta(days=7)),
    )


async def query_content_posts(db: AsyncSession, tab: ContentTab, limit: int = 30):
    await unpin_expired_posts(db)
    now = datetime.now(timezone.utc)
    week = _week_cutoff()
    month = _month_cutoff()

    base = select(Post).options(selectinload(Post.author))

    if tab == "pinned":
        stmt = (
            base.where(Post.is_pinned.is_(True))
            .order_by(Post.pin_order.asc().nulls_last(), desc(Post.pinned_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    if tab == "reported":
        reported_ids = (
            await db.execute(
                select(ContentReport.target_id)
                .where(
                    ContentReport.target_type.in_(["post", "ecosystem_post"]),
                    ContentReport.status.in_(
                        [ReportStatus.pending.value, ReportStatus.under_review.value, "open"]
                    ),
                )
                .distinct()
                .limit(limit)
            )
        ).scalars().all()
        if not reported_ids:
            return []
        stmt = base.where(Post.id.in_(reported_ids)).order_by(desc(Post.created_at)).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    if tab == "recent":
        stmt = base.order_by(desc(Post.created_at)).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    if tab == "trending_week":
        stmt = base.where(Post.created_at >= week).limit(100)
        result = await db.execute(stmt)
        posts = list(result.scalars().all())
        posts.sort(key=trending_score, reverse=True)
        return posts[:limit]

    if tab == "trending_month":
        stmt = base.where(Post.created_at >= month).limit(150)
        result = await db.execute(stmt)
        posts = list(result.scalars().all())
        posts.sort(key=trending_score, reverse=True)
        return posts[:limit]

    if tab == "most_discussed":
        stmt = (
            base.where(Post.created_at >= week)
            .order_by(desc(Post.comments_count), desc(Post.created_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    if tab == "most_liked":
        stmt = (
            base.where(Post.created_at >= week)
            .order_by(desc(Post.likes_count), desc(Post.created_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    return []

