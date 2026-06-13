from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import SuperAdminUser
from app.models.admin_console import (
    AdminAnnouncement,
    AdminAuditLog,
    ContentReport,
    Referral,
    ReportStatus,
    VerificationRequest,
    VerificationStatus,
)
from app.models.connection import Connection, ConnectionStatus
from app.models.meeting import Meeting
from app.models.message import Message
from app.models.platform import PlatformRole
from app.models.post import Post
from app.models.user import User
from app.schemas.admin import (
    AdminMeetingCreate,
    AdminMeetingUpdate,
    AdminOverviewResponse,
    AdminUserDetail,
    AdminUserListItem,
    AnalyticsResponse,
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
    AuditLogResponse,
    PinPostRequest,
    PinnedPostResponse,
    ReferralAnalyticsResponse,
    ReportResponse,
    ResolveReportRequest,
    VerificationResponse,
    VerificationReviewRequest,
)
from app.schemas.auth import MessageResponse
from app.services.audit_log import log_admin_action

router = APIRouter(prefix="/admin", tags=["Admin"])

MAX_PINNED_POSTS = 5


def _start_of_day(dt: datetime | None = None) -> datetime:
    base = dt or datetime.now(timezone.utc)
    return base.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/overview", response_model=AdminOverviewResponse)
async def admin_overview(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_start = _start_of_day(now)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    active_threshold = now - timedelta(minutes=15)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    new_users_today = (
        await db.execute(select(func.count()).select_from(User).where(User.created_at >= today_start))
    ).scalar() or 0
    active_users = (
        await db.execute(
            select(func.count()).select_from(User).where(User.last_active_at >= active_threshold)
        )
    ).scalar() or 0
    dau = (
        await db.execute(select(func.count()).select_from(User).where(User.last_active_at >= today_start))
    ).scalar() or 0
    wau = (
        await db.execute(select(func.count()).select_from(User).where(User.last_active_at >= week_start))
    ).scalar() or 0
    mau = (
        await db.execute(select(func.count()).select_from(User).where(User.last_active_at >= month_start))
    ).scalar() or 0
    verified_users = (
        await db.execute(select(func.count()).select_from(User).where(User.is_verified.is_(True)))
    ).scalar() or 0
    pending_verifications = (
        await db.execute(
            select(func.count())
            .select_from(VerificationRequest)
            .where(VerificationRequest.status == VerificationStatus.pending.value)
        )
    ).scalar() or 0
    total_referrals = (await db.execute(select(func.count()).select_from(Referral))).scalar() or 0
    total_posts = (await db.execute(select(func.count()).select_from(Post))).scalar() or 0
    total_sessions = (await db.execute(select(func.count()).select_from(Meeting))).scalar() or 0
    open_reports = (
        await db.execute(
            select(func.count()).select_from(ContentReport).where(ContentReport.status == ReportStatus.open.value)
        )
    ).scalar() or 0

    return AdminOverviewResponse(
        total_users=total_users,
        new_users_today=new_users_today,
        active_users=active_users,
        daily_active_users=dau,
        weekly_active_users=wau,
        monthly_active_users=mau,
        verified_users=verified_users,
        pending_verifications=pending_verifications,
        total_referrals=total_referrals,
        total_posts=total_posts,
        total_sessions=total_sessions,
        open_reports=open_reports,
    )


@router.get("/users", response_model=dict)
async def list_users(
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = Query(None),
    suspended: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    query = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q.strip()}%"
        query = query.where(or_(User.name.ilike(like), User.email.ilike(like)))
    if suspended is not None:
        query = query.where(User.is_suspended.is_(suspended))

    count_query = select(func.count()).select_from(User)
    if q:
        like = f"%{q.strip()}%"
        count_query = count_query.where(or_(User.name.ilike(like), User.email.ilike(like)))
    if suspended is not None:
        count_query = count_query.where(User.is_suspended.is_(suspended))
    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.offset(offset).limit(limit))
    users = result.scalars().all()

    items: list[AdminUserListItem] = []
    for user in users:
        ref_count = (
            await db.execute(
                select(func.count()).select_from(Referral).where(Referral.referrer_id == user.id)
            )
        ).scalar() or 0
        items.append(
            AdminUserListItem(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role.value if hasattr(user.role, "value") else str(user.role),
                platform_role=user.platform_role or PlatformRole.USER.value,
                country=user.country,
                is_suspended=user.is_suspended,
                is_verified=user.is_verified,
                last_active_at=user.last_active_at,
                created_at=user.created_at,
                referral_count=ref_count,
            )
        )
    return {"users": items, "total": total}


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(user_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    posts_count = (
        await db.execute(select(func.count()).select_from(Post).where(Post.user_id == user.id))
    ).scalar() or 0
    connections_count = (
        await db.execute(
            select(func.count())
            .select_from(Connection)
            .where(
                Connection.status == ConnectionStatus.accepted,
                or_(Connection.sender_id == user.id, Connection.receiver_id == user.id),
            )
        )
    ).scalar() or 0
    ref_count = (
        await db.execute(select(func.count()).select_from(Referral).where(Referral.referrer_id == user.id))
    ).scalar() or 0

    return AdminUserDetail(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        platform_role=user.platform_role or PlatformRole.USER.value,
        country=user.country,
        is_suspended=user.is_suspended,
        is_verified=user.is_verified,
        last_active_at=user.last_active_at,
        created_at=user.created_at,
        referral_count=ref_count,
        bio=user.bio,
        college=user.college,
        company=user.company,
        posts_count=posts_count,
        connections_count=connections_count,
        login_streak_current=user.login_streak_current,
        login_streak_longest=user.login_streak_longest,
    )


@router.post("/users/{user_id}/suspend", response_model=MessageResponse)
async def suspend_user(user_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.platform_role == PlatformRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot suspend super admin")
    user.is_suspended = True
    await log_admin_action(db, admin.id, "user_suspended", "user", str(user_id))
    return MessageResponse(message="User suspended")


@router.post("/users/{user_id}/reactivate", response_model=MessageResponse)
async def reactivate_user(user_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.is_suspended = False
    await log_admin_action(db, admin.id, "user_reactivated", "user", str(user_id))
    return MessageResponse(message="User reactivated")


@router.get("/announcements", response_model=dict)
async def list_announcements(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AdminAnnouncement).order_by(desc(AdminAnnouncement.created_at)))
    items = [AnnouncementResponse.model_validate(a) for a in result.scalars().all()]
    return {"announcements": items}


@router.post("/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    body: AnnouncementCreate, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)
):
    announcement = AdminAnnouncement(
        title=body.title,
        content=body.content,
        audience=body.audience,
        created_by_id=admin.id,
    )
    db.add(announcement)
    await db.flush()
    await log_admin_action(db, admin.id, "announcement_created", "announcement", str(announcement.id))
    return AnnouncementResponse.model_validate(announcement)


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementResponse)
async def update_announcement(
    announcement_id: UUID,
    body: AnnouncementUpdate,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    announcement = await db.get(AdminAnnouncement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    if body.title is not None:
        announcement.title = body.title
    if body.content is not None:
        announcement.content = body.content
    if body.audience is not None:
        announcement.audience = body.audience
    await log_admin_action(db, admin.id, "announcement_updated", "announcement", str(announcement_id))
    return AnnouncementResponse.model_validate(announcement)


@router.delete("/announcements/{announcement_id}", response_model=MessageResponse)
async def delete_announcement(
    announcement_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)
):
    announcement = await db.get(AdminAnnouncement, announcement_id)
    if not announcement:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    await db.delete(announcement)
    await log_admin_action(db, admin.id, "announcement_deleted", "announcement", str(announcement_id))
    return MessageResponse(message="Announcement deleted")


@router.get("/pinned", response_model=dict)
async def list_pinned_posts(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.is_pinned.is_(True))
        .order_by(Post.pin_order.asc().nulls_last(), desc(Post.created_at))
    )
    items = [
        PinnedPostResponse(
            id=p.id,
            content=p.content[:200],
            pin_order=p.pin_order,
            author_name=p.author.name if p.author else "Unknown",
            created_at=p.created_at,
        )
        for p in result.scalars().all()
    ]
    return {"pinned_posts": items}


@router.post("/pinned", response_model=MessageResponse)
async def pin_post(body: PinPostRequest, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    pinned_count = (
        await db.execute(select(func.count()).select_from(Post).where(Post.is_pinned.is_(True)))
    ).scalar() or 0
    post = await db.get(Post, body.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if not post.is_pinned and pinned_count >= MAX_PINNED_POSTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 5 pinned posts allowed")
    post.is_pinned = True
    post.pin_order = body.pin_order if body.pin_order is not None else pinned_count + 1
    await log_admin_action(db, admin.id, "post_pinned", "post", str(post.id))
    return MessageResponse(message="Post pinned")


@router.delete("/pinned/{post_id}", response_model=MessageResponse)
async def unpin_post(post_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.is_pinned = False
    post.pin_order = None
    await log_admin_action(db, admin.id, "post_unpinned", "post", str(post_id))
    return MessageResponse(message="Post unpinned")


@router.get("/verification", response_model=dict)
async def list_verifications(
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    query = select(VerificationRequest).options(selectinload(VerificationRequest.user))
    if status_filter:
        query = query.where(VerificationRequest.status == status_filter)
    query = query.order_by(desc(VerificationRequest.created_at))
    result = await db.execute(query)
    items = [
        VerificationResponse(
            id=v.id,
            user_id=v.user_id,
            user_name=v.user.name if v.user else "Unknown",
            document_type=v.document_type,
            document_url=v.document_url,
            status=v.status,
            created_at=v.created_at,
            review_note=v.review_note,
        )
        for v in result.scalars().all()
    ]
    return {"verifications": items}


@router.post("/verification/{request_id}/approve", response_model=MessageResponse)
async def approve_verification(
    request_id: UUID,
    body: VerificationReviewRequest,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(VerificationRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification request not found")
    req.status = VerificationStatus.approved.value
    req.reviewed_by_id = admin.id
    req.review_note = body.note
    req.reviewed_at = datetime.now(timezone.utc)
    user = await db.get(User, req.user_id)
    if user:
        user.is_verified = True
    await log_admin_action(db, admin.id, "verification_approved", "verification", str(request_id))
    return MessageResponse(message="Verification approved")


@router.post("/verification/{request_id}/reject", response_model=MessageResponse)
async def reject_verification(
    request_id: UUID,
    body: VerificationReviewRequest,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(VerificationRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification request not found")
    req.status = VerificationStatus.rejected.value
    req.reviewed_by_id = admin.id
    req.review_note = body.note
    req.reviewed_at = datetime.now(timezone.utc)
    await log_admin_action(db, admin.id, "verification_rejected", "verification", str(request_id))
    return MessageResponse(message="Verification rejected")


@router.get("/referrals", response_model=ReferralAnalyticsResponse)
async def referral_analytics(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count()).select_from(Referral))).scalar() or 0
    month_start = datetime.now(timezone.utc) - timedelta(days=30)
    growth = (
        await db.execute(select(func.count()).select_from(Referral).where(Referral.created_at >= month_start))
    ).scalar() or 0

    top_result = await db.execute(
        select(Referral.referrer_id, func.count().label("count"))
        .group_by(Referral.referrer_id)
        .order_by(desc("count"))
        .limit(10)
    )
    top_referrers = []
    for referrer_id, count in top_result.all():
        user = await db.get(User, referrer_id)
        top_referrers.append(
            {"user_id": str(referrer_id), "name": user.name if user else "Unknown", "count": count}
        )

    return ReferralAnalyticsResponse(
        total_referrals=total,
        top_referrers=top_referrers,
        growth_last_30_days=growth,
    )


@router.get("/reports", response_model=dict)
async def list_reports(
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
    status_filter: Optional[str] = Query("open", alias="status"),
):
    query = select(ContentReport).options(selectinload(ContentReport.reporter))
    if status_filter:
        query = query.where(ContentReport.status == status_filter)
    query = query.order_by(desc(ContentReport.created_at))
    result = await db.execute(query)
    items = [
        ReportResponse(
            id=r.id,
            reporter_name=r.reporter.name if r.reporter else "Unknown",
            target_type=r.target_type,
            target_id=r.target_id,
            reason=r.reason,
            details=r.details,
            status=r.status,
            created_at=r.created_at,
        )
        for r in result.scalars().all()
    ]
    return {"reports": items}


@router.post("/reports/{report_id}/resolve", response_model=MessageResponse)
async def resolve_report(
    report_id: UUID,
    body: ResolveReportRequest,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(ContentReport, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report.status = ReportStatus.resolved.value
    report.resolved_by_id = admin.id
    report.resolution_note = body.resolution_note
    report.resolved_at = datetime.now(timezone.utc)

    if body.remove_content and report.target_type == "post":
        try:
            post = await db.get(Post, UUID(report.target_id))
            if post:
                await db.delete(post)
        except ValueError:
            pass

    await log_admin_action(db, admin.id, "report_resolved", "report", str(report_id))
    return MessageResponse(message="Report resolved")


@router.get("/sessions", response_model=dict)
async def list_sessions(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Meeting)
        .options(selectinload(Meeting.organizer), selectinload(Meeting.invitee))
        .order_by(desc(Meeting.scheduled_at))
    )
    meetings = result.scalars().unique().all()
    return {
        "sessions": [
            {
                "id": str(m.id),
                "title": m.title,
                "status": m.status,
                "scheduled_at": m.scheduled_at.isoformat(),
                "organizer": m.organizer.name if m.organizer else None,
                "invitee": m.invitee.name if m.invitee else None,
                "meeting_type": m.meeting_type,
            }
            for m in meetings
        ]
    }


@router.post("/sessions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: AdminMeetingCreate, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)
):
    meeting = Meeting(
        organizer_id=body.organizer_id,
        invitee_id=body.invitee_id,
        title=body.title,
        description=body.description,
        scheduled_at=body.scheduled_at,
        meeting_type=body.meeting_type,
        duration_minutes=body.duration_minutes,
        status="pending",
    )
    db.add(meeting)
    await db.flush()
    await log_admin_action(db, admin.id, "session_created", "meeting", str(meeting.id))
    return {"session": {"id": str(meeting.id), "title": meeting.title}}


@router.patch("/sessions/{session_id}", response_model=MessageResponse)
async def update_session(
    session_id: UUID,
    body: AdminMeetingUpdate,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, session_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    for field in ("title", "description", "scheduled_at", "meeting_type", "status", "duration_minutes"):
        value = getattr(body, field)
        if value is not None:
            setattr(meeting, field, value)
    await log_admin_action(db, admin.id, "session_updated", "meeting", str(session_id))
    return MessageResponse(message="Session updated")


@router.delete("/sessions/{session_id}", response_model=MessageResponse)
async def cancel_session(session_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    meeting = await db.get(Meeting, session_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    meeting.status = "cancelled"
    await log_admin_action(db, admin.id, "session_cancelled", "meeting", str(session_id))
    return MessageResponse(message="Session cancelled")


@router.get("/analytics", response_model=AnalyticsResponse)
async def admin_analytics(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    user_growth = []
    for days_ago in range(6, -1, -1):
        day_start = _start_of_day(now - timedelta(days=days_ago))
        day_end = day_start + timedelta(days=1)
        count = (
            await db.execute(
                select(func.count()).select_from(User).where(
                    and_(User.created_at >= day_start, User.created_at < day_end)
                )
            )
        ).scalar() or 0
        user_growth.append({"date": day_start.date().isoformat(), "count": count})

    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    today_start = _start_of_day(now)

    dau = (
        await db.execute(select(func.count()).select_from(User).where(User.last_active_at >= today_start))
    ).scalar() or 0
    wau = (
        await db.execute(select(func.count()).select_from(User).where(User.last_active_at >= week_start))
    ).scalar() or 0
    mau = (
        await db.execute(select(func.count()).select_from(User).where(User.last_active_at >= month_start))
    ).scalar() or 0

    country_result = await db.execute(
        select(User.country, func.count())
        .where(User.country.isnot(None), User.country != "")
        .group_by(User.country)
        .order_by(desc(func.count()))
        .limit(10)
    )
    by_country = {row[0]: row[1] for row in country_result.all() if row[0]}

    connections_count = (
        await db.execute(
            select(func.count()).select_from(Connection).where(Connection.status == ConnectionStatus.accepted)
        )
    ).scalar() or 0
    messages_count = (await db.execute(select(func.count()).select_from(Message))).scalar() or 0
    referrals_count = (await db.execute(select(func.count()).select_from(Referral))).scalar() or 0
    pending_ver = (
        await db.execute(
            select(func.count())
            .select_from(VerificationRequest)
            .where(VerificationRequest.status == VerificationStatus.pending.value)
        )
    ).scalar() or 0
    approved_ver = (
        await db.execute(select(func.count()).select_from(User).where(User.is_verified.is_(True)))
    ).scalar() or 0

    return AnalyticsResponse(
        user_growth=user_growth,
        engagement={"dau": dau, "wau": wau, "mau": mau},
        geography={"by_country": by_country},
        networking={
            "connections": connections_count,
            "messages": messages_count,
            "referrals": referrals_count,
        },
        verification={"pending": pending_ver, "approved": approved_ver},
    )


@router.get("/audit-logs", response_model=dict)
async def list_audit_logs(
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
):
    result = await db.execute(
        select(AdminAuditLog)
        .options(selectinload(AdminAuditLog.actor))
        .order_by(desc(AdminAuditLog.created_at))
        .limit(limit)
    )
    items = [
        AuditLogResponse(
            id=log.id,
            actor_name=log.actor.name if log.actor else None,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            created_at=log.created_at,
        )
        for log in result.scalars().all()
    ]
    return {"audit_logs": items}


@router.get("/settings", response_model=dict)
async def admin_settings(admin: SuperAdminUser):
    return {
        "platform": "NEXUS",
        "admin_email": admin.email,
        "max_pinned_posts": MAX_PINNED_POSTS,
        "roles": [PlatformRole.USER.value, PlatformRole.SUPER_ADMIN.value],
    }
