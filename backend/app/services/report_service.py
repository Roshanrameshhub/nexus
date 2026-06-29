from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_console import ContentReport, ReportReason, ReportStatus, ReportType
from app.models.comment import Comment
from app.models.notification import Notification
from app.models.platform import PlatformRole
from app.models.post import Post
from app.models.user import User

HIGH_PRIORITY_THRESHOLD = 5

ACTIVE_STATUSES = (
    ReportStatus.pending.value,
    ReportStatus.under_review.value,
    "open",
)

VALID_REPORT_TYPES = {t.value for t in ReportType}
VALID_REASONS = {r.value for r in ReportReason}


def normalize_status(status_value: str) -> str:
    if status_value == "open":
        return ReportStatus.pending.value
    return status_value


async def resolve_reported_user_id(
    db: AsyncSession, report_type: str, content_id: str
) -> UUID | None:
    if report_type in (ReportType.post.value, ReportType.ecosystem_post.value):
        try:
            post = await db.get(Post, UUID(content_id))
            return post.user_id if post else None
        except ValueError:
            return None
    if report_type == ReportType.comment.value:
        try:
            comment = await db.get(Comment, UUID(content_id))
            return comment.user_id if comment else None
        except ValueError:
            return None
    if report_type == ReportType.profile.value:
        try:
            return UUID(content_id)
        except ValueError:
            return None
    return None


async def get_content_preview(db: AsyncSession, report_type: str, content_id: str) -> str | None:
    if report_type in (ReportType.post.value, ReportType.ecosystem_post.value):
        try:
            post = await db.get(Post, UUID(content_id))
            if post and post.content:
                return post.content[:300]
        except ValueError:
            pass
        return None
    if report_type == ReportType.comment.value:
        try:
            comment = await db.get(Comment, UUID(content_id))
            if comment and comment.content:
                return comment.content[:300]
        except ValueError:
            pass
        return None
    if report_type == ReportType.profile.value:
        try:
            user = await db.get(User, UUID(content_id))
            if user:
                parts = [user.name]
                if user.bio:
                    parts.append(user.bio[:200])
                return " · ".join(parts)
        except ValueError:
            pass
        return None
    return None


async def validate_report_target(db: AsyncSession, report_type: str, content_id: str) -> None:
    reported_user_id = await resolve_reported_user_id(db, report_type, content_id)
    if reported_user_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reported content not found")


async def notify_admins(
    db: AsyncSession,
    content: str,
    notification_type: str,
) -> None:
    result = await db.execute(
        select(User).where(User.platform_role == PlatformRole.SUPER_ADMIN.value)
    )
    for admin in result.scalars().all():
        db.add(
            Notification(
                user_id=admin.id,
                type=notification_type,
                content=content,
            )
        )


async def update_high_priority_flags(
    db: AsyncSession, report_type: str, content_id: str
) -> bool:
    count = (
        await db.execute(
            select(func.count())
            .select_from(ContentReport)
            .where(
                ContentReport.target_type == report_type,
                ContentReport.target_id == content_id,
                ContentReport.status.in_(ACTIVE_STATUSES),
            )
        )
    ).scalar() or 0

    is_high = count >= HIGH_PRIORITY_THRESHOLD
    result = await db.execute(
        select(ContentReport).where(
            ContentReport.target_type == report_type,
            ContentReport.target_id == content_id,
            ContentReport.status.in_(ACTIVE_STATUSES),
        )
    )
    for report in result.scalars().all():
        report.is_high_priority = is_high
    return is_high


async def create_report(
    db: AsyncSession,
    reporter: User,
    report_type: str,
    content_id: str,
    reason: str,
    notes: str | None,
) -> tuple[ContentReport, bool]:
    if report_type not in VALID_REPORT_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid report type")
    if reason not in VALID_REASONS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid report reason")

    await validate_report_target(db, report_type, content_id)
    reported_user_id = await resolve_reported_user_id(db, report_type, content_id)

    if reported_user_id == reporter.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot report your own content")

    existing = await db.execute(
        select(ContentReport).where(
            ContentReport.reporter_id == reporter.id,
            ContentReport.target_type == report_type,
            ContentReport.target_id == content_id,
            ContentReport.status.in_(ACTIVE_STATUSES),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reported this content",
        )

    report = ContentReport(
        reporter_id=reporter.id,
        reported_user_id=reported_user_id,
        target_type=report_type,
        target_id=content_id,
        reason=reason,
        details=notes,
        status=ReportStatus.pending.value,
    )
    db.add(report)
    await db.flush()

    is_high = await update_high_priority_flags(db, report_type, content_id)

    preview = await get_content_preview(db, report_type, content_id) or content_id
    await notify_admins(
        db,
        f"New report: {report_type} — {reason} — {preview[:80]}",
        "admin_report",
    )
    if is_high:
        await notify_admins(
            db,
            f"High-priority report ({HIGH_PRIORITY_THRESHOLD}+ reports): {report_type} {content_id}",
            "admin_report_high_priority",
        )

    return report, is_high


async def get_grouped_reports(
    db: AsyncSession,
    target_type_filter: str | None = None,
    status_filter: str | None = None,
) -> list[dict]:
    status_values = ACTIVE_STATUSES
    if status_filter:
        normalized = normalize_status(status_filter)
        if normalized in {s.value for s in ReportStatus}:
            status_values = (normalized,)

    filters = [ContentReport.status.in_(status_values)]
    if target_type_filter:
        if target_type_filter == "post":
            filters.append(
                ContentReport.target_type.in_([ReportType.post.value, ReportType.ecosystem_post.value])
            )
        else:
            filters.append(ContentReport.target_type == target_type_filter)

    result = await db.execute(
        select(ContentReport)
        .where(and_(*filters))
        .order_by(ContentReport.created_at.desc())
    )
    reports = list(result.scalars().all())
    if not reports:
        return []

    groups: dict[tuple[str, str], list[ContentReport]] = {}
    for report in reports:
        key = (report.target_type, report.target_id)
        groups.setdefault(key, []).append(report)

    grouped: list[dict] = []
    for (target_type, target_id), group_reports in groups.items():
        reporter_ids: dict[UUID, str] = {}
        reasons: set[str] = set()
        is_high = False
        latest_at = group_reports[0].created_at
        status_value = ReportStatus.pending.value

        for r in group_reports:
            reasons.add(r.reason)
            if r.is_high_priority:
                is_high = True
            if r.created_at > latest_at:
                latest_at = r.created_at
            if r.status == ReportStatus.under_review.value:
                status_value = ReportStatus.under_review.value

        reporter_user_ids = {r.reporter_id for r in group_reports}
        reporter_result = await db.execute(select(User).where(User.id.in_(reporter_user_ids)))
        for u in reporter_result.scalars().all():
            reporter_ids[u.id] = u.name

        reported_user_id = group_reports[0].reported_user_id
        reported_user_name = None
        if reported_user_id:
            reported_user = await db.get(User, reported_user_id)
            reported_user_name = reported_user.name if reported_user else None
        else:
            reported_user_id = await resolve_reported_user_id(db, target_type, target_id)

        preview = await get_content_preview(db, target_type, target_id)

        grouped.append(
            {
                "target_type": target_type,
                "target_id": target_id,
                "reported_user_id": reported_user_id,
                "reported_user_name": reported_user_name,
                "content_preview": preview,
                "reasons": sorted(reasons),
                "report_count": len(group_reports),
                "reporters": [
                    {"id": rid, "name": reporter_ids.get(rid, "Unknown")}
                    for rid in reporter_user_ids
                ],
                "is_high_priority": is_high or len(group_reports) >= HIGH_PRIORITY_THRESHOLD,
                "status": status_value,
                "latest_report_at": latest_at,
                "report_ids": [r.id for r in group_reports],
            }
        )

    grouped.sort(key=lambda g: (not g["is_high_priority"], g["latest_report_at"]), reverse=True)
    return grouped


async def apply_moderation_action(
    db: AsyncSession,
    admin: User,
    target_type: str,
    target_id: str,
    action: str,
    note: str | None,
) -> str:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(ContentReport).where(
            ContentReport.target_type == target_type,
            ContentReport.target_id == target_id,
            ContentReport.status.in_(ACTIVE_STATUSES),
        )
    )
    reports = list(result.scalars().all())
    if not reports:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active reports found")

    reported_user_id = reports[0].reported_user_id or await resolve_reported_user_id(
        db, target_type, target_id
    )

    if action == "ignore":
        new_status = ReportStatus.rejected.value
    elif action in ("remove_post", "delete_comment", "warn", "suspend", "ban"):
        new_status = ReportStatus.resolved.value
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid action")

    for report in reports:
        report.status = new_status
        report.resolved_by_id = admin.id
        report.resolution_note = note
        report.resolved_at = now

    if action == "remove_post" and target_type in (ReportType.post.value, ReportType.ecosystem_post.value):
        try:
            post = await db.get(Post, UUID(target_id))
            if post:
                await db.delete(post)
        except ValueError:
            pass

    if action == "delete_comment" and target_type == ReportType.comment.value:
        try:
            comment = await db.get(Comment, UUID(target_id))
            if comment:
                await db.delete(comment)
        except ValueError:
            pass

    if reported_user_id:
        target_user = await db.get(User, reported_user_id)
        if target_user and target_user.platform_role != PlatformRole.SUPER_ADMIN.value:
            if action == "warn":
                db.add(
                    Notification(
                        user_id=target_user.id,
                        type="moderation_warning",
                        content=note or "Your content has been flagged by our moderation team. Please review our community guidelines.",
                    )
                )
            elif action == "suspend":
                target_user.is_suspended = True
            elif action == "ban":
                target_user.is_banned = True
                target_user.is_suspended = True

    messages = {
        "ignore": "Report ignored",
        "remove_post": "Post removed and report resolved",
        "delete_comment": "Comment deleted and report resolved",
        "warn": "User warned and report resolved",
        "suspend": "User suspended and report resolved",
        "ban": "User banned and report resolved",
    }
    return messages.get(action, "Action completed")
