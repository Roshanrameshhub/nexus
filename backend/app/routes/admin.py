from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, Response
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
from app.constants.verification import document_type_label, verification_type_label
from app.schemas.admin import (
    AdminContentPostResponse,
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
from app.schemas.broadcast import BroadcastAdminPostCreate, BroadcastNotificationCreate
from app.schemas.auth import MessageResponse
from app.schemas.reports import (
    DeleteUserRequest,
    ModerationActionRequest,
    ReportGroupResponse,
    WarnUserRequest,
)
from app.services.report_service import ACTIVE_STATUSES, apply_moderation_action, get_grouped_reports
from app.services.audit_log import log_admin_action
from app.services.content_promotion_service import (
    MAX_PINNED_POSTS,
    pin_expiry_from_days,
    query_content_posts,
    trending_score,
    unpin_expired_posts,
)
from app.utils.paths import UPLOAD_DIR
from app.services.streak_service import days_active_this_month

router = APIRouter(prefix="/admin", tags=["Admin"])


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
            select(func.count()).select_from(ContentReport).where(ContentReport.status.in_(ACTIVE_STATUSES))
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
                is_online=bool(getattr(user, "is_online", False)),
                last_seen_at=getattr(user, "last_seen_at", None),
                created_at=user.created_at,
                referral_count=ref_count,
                current_streak=int(user.login_streak_current or 0),
                longest_streak=int(user.login_streak_longest or 0),
                streak_started_at=user.streak_started_at,
                city=user.city,
                state=user.state,
            )
        )
    return {"users": items, "total": total}


@router.get("/streaks", response_model=dict)
async def streak_leaderboard(
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
    sort_by: str = Query("current", pattern="^(current|longest|monthly|all_time)$"),
    role: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    verified_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
):
    query = select(User).where(User.is_banned.is_(False))
    if role:
        query = query.where(User.role == role)
    if country:
        query = query.where(User.country.ilike(f"%{country.strip()}%"))
    if state:
        query = query.where(User.state.ilike(f"%{state.strip()}%"))
    if city:
        query = query.where(User.city.ilike(f"%{city.strip()}%"))
    if verified_only:
        query = query.where(User.is_verified.is_(True))

    result = await db.execute(query)
    users = result.scalars().all()

    rows: list[dict] = []
    for user in users:
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
        monthly_days = await days_active_this_month(db, user.id)
        rows.append(
            {
                "id": str(user.id),
                "name": user.name,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
                "current_streak": int(user.login_streak_current or 0),
                "longest_streak": int(user.login_streak_longest or 0),
                "country": user.country,
                "state": user.state,
                "city": user.city,
                "connections_count": int(connections_count),
                "posts_count": int(posts_count),
                "last_active_at": user.last_active_at,
                "is_verified": bool(user.is_verified),
                "streak_started_at": user.streak_started_at,
                "days_active_this_month": int(monthly_days),
            }
        )

    if sort_by == "current":
        rows.sort(key=lambda x: (x["current_streak"], x["longest_streak"]), reverse=True)
    elif sort_by in ("longest", "all_time"):
        rows.sort(key=lambda x: (x["longest_streak"], x["current_streak"]), reverse=True)
    else:
        rows.sort(key=lambda x: (x["days_active_this_month"], x["current_streak"]), reverse=True)

    ranked = rows[:limit]
    top_current = max(rows, key=lambda x: x["current_streak"], default=None)
    top_longest = max(rows, key=lambda x: x["longest_streak"], default=None)
    top_monthly = max(rows, key=lambda x: x["days_active_this_month"], default=None)

    return {
        "leaderboard": [
            {
                **row,
                "rank": idx + 1,
            }
            for idx, row in enumerate(ranked)
        ],
        "top_cards": {
            "highest_current_streak": top_current,
            "highest_longest_streak": top_longest,
            "most_active_this_month": top_monthly,
        },
    }


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
    monthly_active_days = await days_active_this_month(db, user.id)

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
        current_streak=int(user.login_streak_current or 0),
        longest_streak=int(user.login_streak_longest or 0),
        streak_started_at=user.streak_started_at,
        city=user.city,
        state=user.state,
        days_active_this_month=monthly_active_days,
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


@router.post("/users/{user_id}/ban", response_model=MessageResponse)
async def ban_user(user_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.platform_role == PlatformRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot ban super admin")
    user.is_banned = True
    user.is_suspended = True
    await log_admin_action(db, admin.id, "user_banned", "user", str(user_id))
    return MessageResponse(message="User banned")


@router.post("/users/{user_id}/warn", response_model=MessageResponse)
async def warn_user(
    user_id: UUID,
    body: WarnUserRequest,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    from app.models.notification import Notification

    db.add(
        Notification(
            user_id=user.id,
            type="moderation_warning",
            content=body.message
            or "Your account activity has been flagged. Please review our community guidelines.",
        )
    )
    await log_admin_action(db, admin.id, "user_warned", "user", str(user_id))
    return MessageResponse(message="Warning sent to user")


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user_permanently(
    user_id: UUID,
    body: DeleteUserRequest,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.platform_role == PlatformRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete super admin")
    if body.confirm_email.strip().lower() != user.email.strip().lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email confirmation does not match",
        )
    await log_admin_action(db, admin.id, "user_deleted", "user", str(user_id), details=user.email)
    await db.delete(user)
    return MessageResponse(message="User permanently deleted")


@router.post("/users/{user_id}/reactivate", response_model=MessageResponse)
async def reactivate_user(user_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Banned users cannot be reactivated. Use ban removal separately.",
        )
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
    from app.services.broadcast_service import create_broadcast_record, publish_announcement_broadcast

    announcement = AdminAnnouncement(
        title=body.title,
        content=body.content,
        audience=body.audience,
        priority=body.priority,
        expires_at=body.expires_at,
        publish_at=body.publish_at or datetime.now(timezone.utc),
        cta_label=body.cta_label,
        cta_url=body.cta_url,
        custom_audience=body.custom_audience,
        target_country=body.target_country,
        target_city=body.target_city,
        show_in_dashboard=body.show_in_dashboard,
        show_in_notification_center=body.show_in_notification_center,
        send_in_app_notification=body.send_in_app_notification,
        send_browser_push=body.send_browser_push,
        send_mobile_push=body.send_mobile_push,
        created_by_id=admin.id,
    )
    db.add(announcement)
    await db.flush()

    broadcast = await create_broadcast_record(
        db,
        broadcast_type="announcement",
        title=body.title,
        content=body.content,
        audience=body.audience,
        custom_audience=body.custom_audience,
        target_country=body.target_country,
        target_city=body.target_city,
        show_in_dashboard=body.show_in_dashboard,
        show_in_notification_center=body.show_in_notification_center,
        send_in_app_notification=body.send_in_app_notification,
        send_browser_push=body.send_browser_push,
        send_mobile_push=body.send_mobile_push,
        created_by_id=admin.id,
        announcement_id=announcement.id,
    )
    announcement.broadcast_id = broadcast.id
    await publish_announcement_broadcast(db, announcement, broadcast)
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
    if body.priority is not None:
        announcement.priority = body.priority
    if body.expires_at is not None:
        announcement.expires_at = body.expires_at
    if body.publish_at is not None:
        announcement.publish_at = body.publish_at
    if body.cta_label is not None:
        announcement.cta_label = body.cta_label
    if body.cta_url is not None:
        announcement.cta_url = body.cta_url
    if body.custom_audience is not None:
        announcement.custom_audience = body.custom_audience
    if body.target_country is not None:
        announcement.target_country = body.target_country
    if body.target_city is not None:
        announcement.target_city = body.target_city
    if body.show_in_dashboard is not None:
        announcement.show_in_dashboard = body.show_in_dashboard
    if body.show_in_notification_center is not None:
        announcement.show_in_notification_center = body.show_in_notification_center
    if body.send_in_app_notification is not None:
        announcement.send_in_app_notification = body.send_in_app_notification
    if body.send_browser_push is not None:
        announcement.send_browser_push = body.send_browser_push
    if body.send_mobile_push is not None:
        announcement.send_mobile_push = body.send_mobile_push
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


@router.get("/broadcasts", response_model=dict)
async def list_broadcasts(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    from app.models.broadcast import AdminBroadcast

    result = await db.execute(select(AdminBroadcast).order_by(desc(AdminBroadcast.created_at)).limit(50))
    items = [
        {
            "id": str(b.id),
            "broadcast_type": b.broadcast_type,
            "title": b.title,
            "content": b.content[:200],
            "audience": b.audience,
            "view_count": b.view_count,
            "click_count": b.click_count,
            "notification_open_count": b.notification_open_count,
            "push_delivery_count": b.push_delivery_count,
            "announcement_id": str(b.announcement_id) if b.announcement_id else None,
            "post_id": str(b.post_id) if b.post_id else None,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in result.scalars().all()
    ]
    return {"broadcasts": items}


@router.post("/broadcast/announcement", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def broadcast_announcement(
    body: AnnouncementCreate, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)
):
    return await create_announcement(body, admin, db)


@router.post("/broadcast/admin-post", response_model=dict, status_code=status.HTTP_201_CREATED)
async def broadcast_admin_post(
    body: BroadcastAdminPostCreate,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    from app.services.broadcast_service import publish_admin_post, push_result_payload
    from app.routes.posts import _build_post_response

    poll_details = None
    if body.post_type == "poll" and body.poll_options:
        options = [{"id": f"opt-{i}", "text": t.strip()} for i, t in enumerate(body.poll_options) if t.strip()]
        if len(options) < 2:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll requires at least 2 options")
        poll_details = {"options": options}

    post, broadcast, recipients, push_result = await publish_admin_post(
        db,
        admin,
        content=body.content,
        post_type=body.post_type,
        media=body.media,
        hashtags=body.hashtags,
        poll_details=poll_details,
        official_label=body.official_label,
        show_in_announcements_hub=body.show_in_announcements_hub,
        audience=body.audience,
        custom_audience=body.custom_audience,
        target_country=body.target_country,
        target_city=body.target_city,
        show_in_dashboard=body.show_in_dashboard,
        show_in_notification_center=body.show_in_notification_center,
        send_in_app_notification=body.send_in_app_notification,
        send_browser_push=body.send_browser_push,
        send_mobile_push=body.send_mobile_push,
        title=body.title,
    )
    await log_admin_action(db, admin.id, "admin_post_broadcast", "post", str(post.id))
    return {
        "post": _build_post_response(post, admin.id, False, 0, ({}, None) if poll_details else None),
        "broadcast_id": str(broadcast.id),
        "recipients_notified": recipients,
        **push_result_payload(push_result),
    }


@router.post("/broadcast/notification", response_model=dict, status_code=status.HTTP_201_CREATED)
async def broadcast_notification(
    body: BroadcastNotificationCreate,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    from app.services.broadcast_service import publish_standalone_notification, push_result_payload

    broadcast, recipients, push_result = await publish_standalone_notification(
        db,
        admin,
        title=body.title,
        content=body.content,
        link_url=body.link_url,
        audience=body.audience,
        custom_audience=body.custom_audience,
        target_country=body.target_country,
        target_city=body.target_city,
        show_in_dashboard=body.show_in_dashboard,
        show_in_notification_center=body.show_in_notification_center,
        send_in_app_notification=body.send_in_app_notification,
        send_browser_push=body.send_browser_push,
        send_mobile_push=body.send_mobile_push,
    )
    await log_admin_action(db, admin.id, "notification_broadcast", "broadcast", str(broadcast.id))
    return {
        "broadcast_id": str(broadcast.id),
        "recipients_notified": recipients,
        **push_result_payload(push_result),
    }


@router.get("/content/posts", response_model=dict)
async def list_content_posts(
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
    tab: str = Query("recent"),
    limit: int = Query(30, ge=1, le=50),
):
    allowed = {
        "recent",
        "trending_week",
        "trending_month",
        "most_discussed",
        "most_liked",
        "reported",
        "pinned",
    }
    if tab not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tab")

    posts = await query_content_posts(db, tab, limit=limit)  # type: ignore[arg-type]
    pinned_count = (
        await db.execute(select(func.count()).select_from(Post).where(Post.is_pinned.is_(True)))
    ).scalar() or 0

    items = []
    for p in posts:
        score = trending_score(p) if tab in ("trending_week", "trending_month") else None
        pinned_by_name = None
        if p.pinned_by_id:
            pin_user = await db.get(User, p.pinned_by_id)
            pinned_by_name = pin_user.name if pin_user else None
        items.append(
            AdminContentPostResponse(
                id=p.id,
                content=p.content,
                image_url=p.image_url,
                media=p.media or [],
                post_type=p.post_type.value if hasattr(p.post_type, "value") else p.post_type,
                likes_count=p.likes_count or 0,
                comments_count=p.comments_count or 0,
                shares_count=p.shares_count or 0,
                created_at=p.created_at,
                author_name=p.author.name if p.author else "Unknown",
                author_verified=bool(getattr(p.author, "is_verified", False)) if p.author else False,
                author_avatar=p.author.profile_image if p.author else None,
                is_pinned=bool(p.is_pinned),
                pinned_at=p.pinned_at,
                pinned_by_name=pinned_by_name,
                pin_expires_at=p.pin_expires_at,
                trending_score=score,
            )
        )

    return {
        "posts": items,
        "pinned_count": pinned_count,
        "max_pinned": MAX_PINNED_POSTS,
        "tab": tab,
    }


@router.get("/pinned", response_model=dict)
async def list_pinned_posts(admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    await unpin_expired_posts(db)
    result = await db.execute(
        select(Post)
        .options(selectinload(Post.author), selectinload(Post.pinned_by))
        .where(Post.is_pinned.is_(True))
        .order_by(Post.pin_order.asc().nulls_last(), desc(Post.pinned_at))
    )
    items = [
        PinnedPostResponse(
            id=p.id,
            content=p.content[:200],
            pin_order=p.pin_order,
            author_name=p.author.name if p.author else "Unknown",
            created_at=p.created_at,
            pinned_at=p.pinned_at,
            pinned_by_name=p.pinned_by.name if p.pinned_by else None,
            pin_expires_at=p.pin_expires_at,
        )
        for p in result.scalars().all()
    ]
    return {"pinned_posts": items, "pinned_count": len(items), "max_pinned": MAX_PINNED_POSTS}


@router.post("/pinned", response_model=MessageResponse)
async def pin_post(body: PinPostRequest, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    await unpin_expired_posts(db)
    pinned_count = (
        await db.execute(select(func.count()).select_from(Post).where(Post.is_pinned.is_(True)))
    ).scalar() or 0
    post = await db.get(Post, body.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.is_pinned:
        return MessageResponse(message="Post already pinned")
    if pinned_count >= MAX_PINNED_POSTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {MAX_PINNED_POSTS} pinned posts allowed",
        )
    now = datetime.now(timezone.utc)
    post.is_pinned = True
    post.pin_order = body.pin_order if body.pin_order is not None else pinned_count + 1
    post.pinned_at = now
    post.pinned_by_id = admin.id
    post.pin_expires_at = pin_expiry_from_days(body.expiry_days)
    await log_admin_action(db, admin.id, "post_pinned", "post", str(post.id))
    return MessageResponse(message="Post pinned")


@router.delete("/pinned/{post_id}", response_model=MessageResponse)
async def unpin_post(post_id: UUID, admin: SuperAdminUser, db: AsyncSession = Depends(get_db)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    post.is_pinned = False
    post.pin_order = None
    post.pinned_at = None
    post.pinned_by_id = None
    post.pin_expires_at = None
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
            user_role=(
                v.user.role.value if v.user and hasattr(v.user.role, "value") else str(v.user.role)
                if v.user
                else "unknown"
            ),
            verification_type=verification_type_label(
                v.user.role.value if v.user and hasattr(v.user.role, "value") else str(v.user.role)
                if v.user
                else None
            ),
            document_type=v.document_type,
            document_type_label=document_type_label(v.document_type),
            document_url=v.document_url,
            status=v.status,
            created_at=v.created_at,
            review_note=v.review_note,
        )
        for v in result.scalars().all()
    ]
    return {"verifications": items}


@router.get("/verification/{request_id}/document")
async def get_verification_document(
    request_id: UUID,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(VerificationRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification request not found")

    if req.document_content:
        return Response(
            content=req.document_content,
            media_type=req.document_mime or "application/octet-stream",
            headers={"Content-Disposition": f'inline; filename="verification-{request_id}"'},
        )

    filename = req.document_url.rsplit("/", 1)[-1] if req.document_url else ""
    file_path = UPLOAD_DIR / filename
    if not filename or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    return FileResponse(
        path=file_path,
        media_type=req.document_mime or "application/octet-stream",
        filename=filename,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


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
    status_filter: Optional[str] = Query(None, alias="status"),
    target_type: Optional[str] = Query(None, alias="type"),
):
    groups = await get_grouped_reports(db, target_type_filter=target_type, status_filter=status_filter)
    items = [ReportGroupResponse(**g) for g in groups]
    return {"groups": items, "total": len(items)}


@router.post("/reports/action", response_model=MessageResponse)
async def moderate_reported_content(
    body: ModerationActionRequest,
    admin: SuperAdminUser,
    db: AsyncSession = Depends(get_db),
):
    message = await apply_moderation_action(
        db, admin, body.target_type, body.target_id, body.action, body.note
    )
    await log_admin_action(
        db,
        admin.id,
        f"report_action_{body.action}",
        body.target_type,
        body.target_id,
        details=body.note,
    )
    return MessageResponse(message=message)


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

    if body.remove_content and report.target_type in ("post", "ecosystem_post"):
        try:
            post = await db.get(Post, UUID(report.target_id))
            if post:
                await db.delete(post)
        except ValueError:
            pass
    elif body.remove_content and report.target_type == "comment":
        try:
            from app.models.comment import Comment

            comment = await db.get(Comment, UUID(report.target_id))
            if comment:
                await db.delete(comment)
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
        "platform": "RConnectX",
        "admin_email": admin.email,
        "max_pinned_posts": MAX_PINNED_POSTS,
        "roles": [PlatformRole.USER.value, PlatformRole.SUPER_ADMIN.value],
    }
