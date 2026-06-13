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
from app.utils.country import countries_match

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=dict)
async def get_me(current_user: CurrentUser):
    return {"user": to_user_response(current_user)}


@router.get("/recommendations", response_model=dict)
async def get_recommendations(
    current_user: CurrentUser,
    roles: List[str] = Query(None, alias="role"),
    country: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
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
            )
        )
        referral_peer_ids.update(sibling_result.scalars().all())
    referred_result = await db.execute(
        select(User.id).where(
            User.referred_by_id == current_user.id,
            User.is_suspended.is_(False),
        )
    )
    referral_peer_ids.update(referred_result.scalars().all())

    graph = NetworkGraph.build(
        current_user.id,
        accepted_pairs,
        pending_pairs,
        referral_peer_ids,
    )
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
                or_(*profile_filters),
            ).limit(100)
        )
        candidate_ids.update(profile_result.scalars().all())

    if not candidate_ids:
        fallback_result = await db.execute(
            select(User.id).where(
                User.id != current_user.id,
                User.is_suspended.is_(False),
            ).order_by(User.created_at.desc()).limit(100)
        )
        candidate_ids.update(fallback_result.scalars().all())

    user_query = select(User).where(
        User.id.in_(list(candidate_ids)),
        User.id.notin_(list(excluded)),
        User.is_suspended.is_(False),
    )
    if roles:
        enum_roles = []
        for r in roles:
            if r in UserRole.__members__:
                enum_roles.append(UserRole[r])
            else:
                enum_roles.append(r)
        user_query = user_query.where(User.role.in_(enum_roles))

    user_result = await db.execute(user_query.limit(150))
    users = list(user_result.scalars().all())
    if country:
        users = [u for u in users if countries_match(u.country, country)]

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
                    college=u.college,
                    company=u.company,
                    role_details=u.role_details,
                    match_factors=match_factors,
                    is_verified=bool(getattr(u, "is_verified", False)),
                ),
            )
        )

    scored.sort(key=lambda item: item[0], reverse=True)
    recommendations = [item[1] for item in scored[:20]]
    return {"recommendations": recommendations}


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
