import hashlib
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.connection import Connection, ConnectionStatus
from app.models.follow import Follow
from app.models.user import User, UserRole
from app.models.notification import Notification
from app.schemas.user import UserPublic, UserRecommendation, UserUpdate
from app.schemas.auth import MessageResponse
from app.utils.user_mapper import to_user_public, to_user_response
from app.services.recommendation_service import NetworkGraph, recommendation_service
from app.services.streak_service import days_active_this_month, next_streak_milestone
from app.utils.country import countries_match
from app.utils.location import user_matches_location_filters

router = APIRouter(prefix="/users", tags=["Users"])


def _user_to_listing(
    u: User,
    following: bool,
    *,
    match: str = "",
    match_factors: Optional[List[str]] = None,
    is_connected: bool = False,
) -> UserRecommendation:
    return UserRecommendation(
        id=u.id,
        name=u.name,
        role=u.role.value if hasattr(u.role, "value") else u.role,
        email=u.email,
        avatar=u.profile_image,
        bio=u.bio,
        skills=u.skills or [],
        match=match,
        following=following,
        country=u.country,
        city=getattr(u, "city", None),
        state=getattr(u, "state", None),
        college=u.college,
        company=u.company,
        role_details=u.role_details,
        match_factors=match_factors or [],
        is_verified=bool(getattr(u, "is_verified", False)),
        is_connected=is_connected,
    )


def _stable_shuffle_key(user_id: UUID) -> int:
    digest = hashlib.md5(str(user_id).encode()).hexdigest()
    return int(digest[:8], 16)


async def _build_network_graph(db: AsyncSession, current_user: User) -> NetworkGraph:
    accepted_result = await db.execute(
        select(Connection.sender_id, Connection.receiver_id).where(
            Connection.status == ConnectionStatus.accepted
        )
    )
    accepted_pairs = list(accepted_result.all())

    pending_result = await db.execute(
        select(Connection.sender_id, Connection.receiver_id).where(
            Connection.status == ConnectionStatus.pending,
            or_(
                Connection.sender_id == current_user.id,
                Connection.receiver_id == current_user.id,
            ),
        )
    )
    pending_pairs = list(pending_result.all())

    referral_peer_ids: set = set()
    if current_user.referred_by_id:
        sibling_result = await db.execute(
            select(User.id).where(
                User.referred_by_id == current_user.referred_by_id,
                User.id != current_user.id,
                User.is_suspended.is_(False),
                User.is_banned.is_(False),
            )
        )
        referral_peer_ids.update(sibling_result.scalars().all())
    referred_result = await db.execute(
        select(User.id).where(
            User.referred_by_id == current_user.id,
            User.is_suspended.is_(False),
            User.is_banned.is_(False),
        )
    )
    referral_peer_ids.update(referred_result.scalars().all())

    return NetworkGraph.build(
        current_user.id,
        accepted_pairs,
        pending_pairs,
        referral_peer_ids,
    )


async def _fetch_relationship_recommendations(
    db: AsyncSession,
    current_user: User,
    *,
    roles: Optional[List[str]] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = 20,
) -> tuple[List[UserRecommendation], int]:
    graph = await _build_network_graph(db, current_user)
    excluded = graph.excluded_ids()

    candidate_ids: set = set(graph.second_degree_ids) | set(graph.referral_peer_ids)

    profile_filters = []
    if current_user.college:
        profile_filters.append(func.lower(User.college) == current_user.college.strip().lower())
    if current_user.company:
        profile_filters.append(func.lower(User.company) == current_user.company.strip().lower())
    if current_user.skills:
        profile_filters.append(User.skills.overlap(current_user.skills))

    if profile_filters:
        profile_result = await db.execute(
            select(User.id).where(
                User.id.notin_(list(excluded)),
                User.is_suspended.is_(False),
                User.is_banned.is_(False),
                or_(*profile_filters),
            ).limit(200)
        )
        candidate_ids.update(profile_result.scalars().all())

    if not candidate_ids:
        fallback_result = await db.execute(
            select(User.id).where(
                User.id != current_user.id,
                User.is_suspended.is_(False),
                User.is_banned.is_(False),
            ).order_by(User.created_at.desc()).limit(200)
        )
        candidate_ids.update(fallback_result.scalars().all())

    user_query = select(User).where(
        User.id.in_(list(candidate_ids)),
        User.id.notin_(list(excluded)),
        User.is_suspended.is_(False),
        User.is_banned.is_(False),
    )
    if roles:
        enum_roles = []
        for r in roles:
            if r in UserRole.__members__:
                enum_roles.append(UserRole[r])
            else:
                enum_roles.append(r)
        user_query = user_query.where(User.role.in_(enum_roles))

    user_result = await db.execute(user_query.limit(300))
    users = list(user_result.scalars().all())
    if country or city or state:
        users = [
            u for u in users
            if user_matches_location_filters(u, city=city, state=state, country=country)
        ]

    followed_result = await db.execute(
        select(Follow.followee_id).where(Follow.follower_id == current_user.id)
    )
    followed_ids = set(followed_result.scalars().all())

    scored: List[tuple[int, UserRecommendation]] = []
    for u in users:
        raw_score, match_score, match_factors = recommendation_service.score_relationship_recommendation(
            current_user, u, graph
        )
        if raw_score <= 0:
            continue
        scored.append(
            (
                raw_score,
                UserRecommendation(
                    id=u.id,
                    name=u.name,
                    role=u.role.value if hasattr(u.role, "value") else u.role,
                    email=u.email,
                    avatar=u.profile_image,
                    bio=u.bio,
                    skills=u.skills or [],
                    match=f"{match_score}%",
                    following=u.id in followed_ids,
                    country=u.country,
                    city=getattr(u, "city", None),
                    state=getattr(u, "state", None),
                    college=u.college,
                    company=u.company,
                    role_details=u.role_details,
                    match_factors=match_factors,
                    is_verified=bool(getattr(u, "is_verified", False)),
                ),
            )
        )

    scored.sort(key=lambda item: item[0], reverse=True)
    total = len(scored)
    recommendations = [item[1] for item in scored[:limit]]
    return recommendations, total


@router.get("/me", response_model=dict)
async def get_me(current_user: CurrentUser):
    return {"user": to_user_response(current_user)}


@router.get("/streak", response_model=dict)
async def get_streak_summary(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    current = int(getattr(current_user, "login_streak_current", 0) or 0)
    longest = int(getattr(current_user, "login_streak_longest", 0) or 0)
    milestone = next_streak_milestone(current)
    active_days = await days_active_this_month(db, current_user.id)
    return {
        "current_streak": current,
        "longest_streak": longest,
        "streak_started_at": getattr(current_user, "streak_started_at", None),
        "last_active_date": getattr(current_user, "last_active_date", None),
        "days_active_this_month": active_days,
        "next_milestone": milestone,
        "days_to_next_milestone": max(0, milestone - current),
    }


@router.get("/presence", response_model=dict)
async def get_users_presence(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    ids: str = Query(..., description="Comma-separated user IDs"),
):
    user_ids: list[UUID] = []
    for raw_id in ids.split(","):
        value = raw_id.strip()
        if not value:
            continue
        try:
            user_ids.append(UUID(value))
        except ValueError:
            continue

    if not user_ids:
        return {"presence": []}

    result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users = result.scalars().all()
    presence = [
        {
            "user_id": str(user.id),
            "is_online": bool(getattr(user, "is_online", False)),
            "last_seen_at": getattr(user, "last_seen_at", None),
        }
        for user in users
    ]
    return {"presence": presence}


@router.get("/recommendations", response_model=dict)
async def get_recommendations(
    current_user: CurrentUser,
    roles: List[str] = Query(None, alias="role"),
    country: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    recommendations, total = await _fetch_relationship_recommendations(
        db, current_user, roles=roles, country=country, city=city, state=state, limit=limit
    )
    return {
        "recommendations": recommendations,
        "total": total,
        "has_more": total > limit,
    }


@router.get("/directory", response_model=dict)
async def list_users_directory(
    current_user: CurrentUser,
    roles: List[str] = Query(None, alias="role"),
    country: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """All active users ranked by relevance — never hidden, only ordered."""
    graph = await _build_network_graph(db, current_user)
    connected_ids = set(graph.connected_ids)

    query = select(User).where(
        User.id != current_user.id,
        User.is_suspended.is_(False),
        User.is_banned.is_(False),
    )
    if roles:
        enum_roles = []
        for r in roles:
            if r in UserRole.__members__:
                enum_roles.append(UserRole[r])
            else:
                enum_roles.append(r)
        query = query.where(User.role.in_(enum_roles))

    result = await db.execute(query.limit(500))
    users = list(result.scalars().all())
    if country or city or state:
        users = [
            u for u in users
            if user_matches_location_filters(u, city=city, state=state, country=country)
        ]

    followed_result = await db.execute(
        select(Follow.followee_id).where(Follow.follower_id == current_user.id)
    )
    followed_ids = set(followed_result.scalars().all())

    scored: List[tuple[int, int, UserRecommendation]] = []
    for u in users:
        raw_score, match_pct, match_factors = recommendation_service.score_relationship_recommendation(
            current_user, u, graph
        )
        scored.append(
            (
                raw_score,
                _stable_shuffle_key(u.id),
                _user_to_listing(
                    u,
                    u.id in followed_ids,
                    match=f"{match_pct}%" if match_pct else "",
                    match_factors=match_factors,
                    is_connected=u.id in connected_ids,
                ),
            )
        )

    scored.sort(key=lambda item: (-item[0], item[1]))
    listings = [item[2] for item in scored]
    return {"users": listings, "total": len(listings)}


@router.get("/search", response_model=dict)
async def search_users(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    result = await db.execute(
        select(User).where(
            or_(User.name.ilike(pattern), User.email.ilike(pattern), User.username.ilike(pattern))
        ).limit(20)
    )
    users = [to_user_public(u) for u in result.scalars().all()]
    return {"users": users}


@router.get("/{user_id}", response_model=dict)
async def get_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"user": to_user_public(user, include_email=True)}


@router.patch("/{user_id}", response_model=dict)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    data = body.model_dump(exclude_unset=True)
    if "avatar" in data:
        current_user.profile_image = data.pop("avatar")
    for key, value in data.items():
        if key == "role" and value:
            current_user.role = UserRole(value) if value in UserRole.__members__ else current_user.role
        else:
            setattr(current_user, key, value)

    await db.flush()
    return {"user": to_user_response(current_user)}


@router.post("/{user_id}/follow", response_model=dict, status_code=status.HTTP_201_CREATED)
async def follow_user(user_id: UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.followee_id == user_id,
        )
    )
    if existing.scalar_one_or_none() is None:
        db.add(Follow(follower_id=current_user.id, followee_id=user_id))
        db.add(
            Notification(
                user_id=user_id,
                type="follow",
                content=f"{current_user.name} started following you",
            )
        )
    await db.flush()
    return {"following": True}


@router.delete("/{user_id}/follow", response_model=dict)
async def unfollow_user(user_id: UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    if current_user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot unfollow yourself")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.followee_id == user_id,
        )
    )
    follow = existing.scalar_one_or_none()
    if follow:
        await db.delete(follow)
    await db.flush()
    return {"following": False}
