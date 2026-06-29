from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID
import uuid as uuid_mod

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.admin_console import AdminAnnouncement, AnnouncementDismissal
from app.models.community import Community, community_members
from app.models.connection import Connection, ConnectionStatus
from app.models.notification import Notification
from app.models.post import Post, PostType
from app.models.startup import Startup
from app.models.user import User
from app.routes.posts import _build_post_response
from app.schemas.auth import MessageResponse
from app.schemas.community import CommunityResponse
from app.schemas.dashboard import CountryDiscoveryItem, DashboardActivityItem, DashboardAnnouncement, DashboardResponse, DashboardStats
from app.schemas.startup import StartupResponse
from app.schemas.user import UserRecommendation
from app.routes.users import _fetch_relationship_recommendations
from app.services.announcement_service import get_user_announcements
from app.services.content_promotion_service import unpin_expired_posts
from app.services.ecosystem_service import opportunity_is_active, score_opportunity_for_skills
from app.services.user_activity_service import fetch_user_recent_activity
from app.utils.country import normalize_country

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


async def _build_country_discovery(db: AsyncSession) -> list[CountryDiscoveryItem]:
    result = await db.execute(
        select(User.country).where(
            User.country.isnot(None),
            User.country != "",
        )
    )
    counts: dict[str, int] = {}
    for (raw_country,) in result.all():
        canonical = normalize_country(raw_country)
        if canonical:
            counts[canonical] = counts.get(canonical, 0) + 1

    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    return [CountryDiscoveryItem(country=name, count=count) for name, count in ranked[:10]]


@router.get("", response_model=DashboardResponse)
async def get_dashboard(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    conn_count = await db.execute(
        select(func.count()).select_from(Connection).where(
            Connection.status == ConnectionStatus.accepted,
            or_(Connection.sender_id == current_user.id, Connection.receiver_id == current_user.id),
        )
    )
    posts_count = await db.execute(select(func.count()).select_from(Post).where(Post.user_id == current_user.id))
    comm_count = await db.execute(
        select(func.count()).select_from(community_members).where(community_members.c.user_id == current_user.id)
    )
    unread = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == current_user.id,
            Notification.read_status.is_(False),
        )
    )

    recommendations, recommendations_total = await _fetch_relationship_recommendations(
        db, current_user, limit=5
    )

    await unpin_expired_posts(db)
    pinned_result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.is_pinned.is_(True))
        .order_by(Post.pin_order.asc().nulls_last(), desc(Post.pinned_at))
        .limit(10)
    )
    pinned_posts = [
        _build_post_response(p, current_user.id, False, p.comments_count or 0)
        for p in pinned_result.scalars().all()
    ]

    official_result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.is_official.is_(True))
        .order_by(desc(Post.created_at))
        .limit(5)
    )
    official_posts = [
        _build_post_response(p, current_user.id, False, p.comments_count or 0)
        for p in official_result.scalars().all()
    ]

    user_announcements = await get_user_announcements(db, current_user)
    announcements = [
        DashboardAnnouncement(
            id=str(a.id),
            title=a.title,
            content=a.content,
            priority=a.priority or "medium",
            cta_label=a.cta_label,
            cta_url=a.cta_url,
            dismissible=a.priority in ("low", "medium"),
            created_at=a.created_at,
            created_by_name=a.created_by.name if a.created_by else "RConnectX Team",
        )
        for a in user_announcements
    ]

    posts_result = await db.execute(
        select(Post).options(selectinload(Post.author)).order_by(Post.created_at.desc()).limit(5)
    )
    trending_posts = [
        _build_post_response(p, current_user.id, False, p.comments_count or 0) for p in posts_result.scalars().all()
    ]

    comm_result = await db.execute(select(Community).order_by(Community.created_at.desc()).limit(5))
    active_communities = []
    for c in comm_result.scalars().all():
        mc = await db.execute(
            select(func.count()).select_from(community_members).where(community_members.c.community_id == c.id)
        )
        active_communities.append(
            CommunityResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                creator_id=c.creator_id,
                member_count=mc.scalar() or 0,
                created_at=c.created_at,
            )
        )

    startup_result = await db.execute(select(Startup).order_by(Startup.created_at.desc()).limit(5))
    startup_suggestions = [StartupResponse.model_validate(s) for s in startup_result.scalars().all()]
    country_discovery = await _build_country_discovery(db)

    opp_result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.post_type == PostType.opportunity)
        .order_by(Post.created_at.desc())
        .limit(50)
    )
    user_skills = list(current_user.skills or [])
    active_opps = [p for p in opp_result.scalars().all() if opportunity_is_active(p)]
    ranked_opps = sorted(
        active_opps,
        key=lambda p: score_opportunity_for_skills(p, user_skills),
        reverse=True,
    )[:5]
    trending_opportunities = [
        _build_post_response(p, current_user.id, False, p.comments_count or 0)
        for p in ranked_opps
    ]

    activity_rows = await fetch_user_recent_activity(db, current_user.id, limit=5)
    recent_activity = [
        DashboardActivityItem(
            id=a.id,
            type=a.type,
            title=a.title,
            description=a.description,
            occurred_at=a.occurred_at,
            link=a.link,
        )
        for a in activity_rows
    ]

    return DashboardResponse(
        stats=DashboardStats(
            connections_count=conn_count.scalar() or 0,
            posts_count=posts_count.scalar() or 0,
            communities_count=comm_count.scalar() or 0,
            unread_notifications=unread.scalar() or 0,
        ),
        pinned_posts=pinned_posts,
        official_posts=official_posts,
        announcements=announcements,
        recommendations=recommendations,
        recommendations_total=recommendations_total,
        recommendations_has_more=recommendations_total > 5,
        trending_posts=trending_posts,
        active_communities=active_communities,
        startup_suggestions=startup_suggestions,
        country_discovery=country_discovery,
        trending_opportunities=trending_opportunities,
        recent_activity=recent_activity,
    )


@router.post("/announcements/{announcement_id}/view", response_model=MessageResponse)
async def track_announcement_view(
    announcement_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ann = await db.get(AdminAnnouncement, announcement_id)
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    ann.view_count = (ann.view_count or 0) + 1
    return MessageResponse(message="View recorded")


@router.post("/announcements/{announcement_id}/click", response_model=MessageResponse)
async def track_announcement_click(
    announcement_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ann = await db.get(AdminAnnouncement, announcement_id)
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    ann.click_count = (ann.click_count or 0) + 1
    return MessageResponse(message="Click recorded")


@router.post("/announcements/{announcement_id}/dismiss", response_model=MessageResponse)
async def dismiss_announcement(
    announcement_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    ann = await db.get(AdminAnnouncement, announcement_id)
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    if ann.priority in ("high", "critical"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This announcement cannot be dismissed")
    existing = await db.execute(
        select(AnnouncementDismissal).where(
            AnnouncementDismissal.user_id == current_user.id,
            AnnouncementDismissal.announcement_id == announcement_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(
            AnnouncementDismissal(
                id=uuid_mod.uuid4(),
                user_id=current_user.id,
                announcement_id=announcement_id,
            )
        )
        ann.dismiss_count = (ann.dismiss_count or 0) + 1
    return MessageResponse(message="Announcement dismissed")
