from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.community import Community, community_members
from app.models.connection import Connection, ConnectionStatus
from app.models.notification import Notification
from app.models.post import Post
from app.models.startup import Startup
from app.models.user import User
from app.routes.posts import _build_post_response
from app.schemas.community import CommunityResponse
from app.schemas.dashboard import CountryDiscoveryItem, DashboardResponse, DashboardStats
from app.schemas.startup import StartupResponse
from app.schemas.user import UserRecommendation
from app.services.recommendation_service import recommendation_service
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

    rec_result = await db.execute(
        select(User).where(User.id != current_user.id).order_by(User.created_at.desc()).limit(15)
    )
    
    recommendations = []
    for u in rec_result.scalars().all():
        match_score, match_factors = recommendation_service.calculate_match_score_and_factors(current_user, u)
        recommendations.append(
            UserRecommendation(
                id=u.id,
                name=u.name,
                role=u.role.value if hasattr(u.role, "value") else u.role,
                avatar=u.profile_image,
                bio=u.bio,
                skills=u.skills or [],
                match=f"{match_score}%",
                country=u.country,
                college=u.college,
                company=u.company,
                role_details=u.role_details,
                match_factors=match_factors,
            )
        )
    recommendations.sort(key=lambda r: int(r.match.replace("%", "")), reverse=True)
    recommendations = recommendations[:5]

    posts_result = await db.execute(
        select(Post).options(selectinload(Post.author)).order_by(Post.created_at.desc()).limit(5)
    )
    trending_posts = [
        _build_post_response(p, current_user.id, False, 0) for p in posts_result.scalars().all()
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

    return DashboardResponse(
        stats=DashboardStats(
            connections_count=conn_count.scalar() or 0,
            posts_count=posts_count.scalar() or 0,
            communities_count=comm_count.scalar() or 0,
            unread_notifications=unread.scalar() or 0,
        ),
        recommendations=recommendations,
        trending_posts=trending_posts,
        active_communities=active_communities,
        startup_suggestions=startup_suggestions,
        country_discovery=country_discovery,
    )
