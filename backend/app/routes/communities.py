from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.community import Community, CommunityDiscussion, community_members
from app.models.user import User
from app.schemas.community import CommunityCreate, CommunityResponse, DiscussionCreate, DiscussionResponse
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/communities", tags=["Communities"])


@router.get("", response_model=dict)
async def list_communities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).order_by(Community.created_at.desc()))
    communities = []
    for c in result.scalars().all():
        count = await db.execute(
            select(func.count()).select_from(community_members).where(
                community_members.c.community_id == c.id
            )
        )
        communities.append(
            CommunityResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                creator_id=c.creator_id,
                member_count=count.scalar() or 0,
                created_at=c.created_at,
            )
        )
    return {"communities": communities}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_community(
    body: CommunityCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    community = Community(
        name=body.name,
        description=body.description,
        creator_id=current_user.id,
        members=[current_user],
    )
    db.add(community)
    await db.flush()
    return {
        "community": CommunityResponse(
            id=community.id,
            name=community.name,
            description=community.description,
            creator_id=community.creator_id,
            member_count=1,
            created_at=community.created_at,
        )
    }


@router.get("/{community_id}", response_model=dict)
async def get_community(community_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).where(Community.id == community_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    count = await db.execute(
        select(func.count()).select_from(community_members).where(community_members.c.community_id == c.id)
    )
    return {
        "community": CommunityResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            creator_id=c.creator_id,
            member_count=count.scalar() or 0,
            created_at=c.created_at,
        )
    }


@router.get("/{community_id}/discussions", response_model=dict)
async def get_discussions(community_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CommunityDiscussion)
        .options(selectinload(CommunityDiscussion.community))
        .where(CommunityDiscussion.community_id == community_id)
        .order_by(CommunityDiscussion.created_at.desc())
    )
    discussions = []
    for d in result.scalars().all():
        author = await db.get(User, d.user_id)
        discussions.append(
            DiscussionResponse(
                id=d.id,
                title=d.title,
                content=d.content,
                created_at=d.created_at,
                author=to_user_public(author) if author else None,
            )
        )
    return {"discussions": discussions}


@router.post("/{community_id}/discussions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_discussion(
    community_id: UUID,
    body: DiscussionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Community).where(Community.id == community_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

    discussion = CommunityDiscussion(
        community_id=community_id,
        user_id=current_user.id,
        title=body.title,
        content=body.content,
    )
    db.add(discussion)
    await db.flush()
    return {
        "discussion": DiscussionResponse(
            id=discussion.id,
            title=discussion.title,
            content=discussion.content,
            created_at=discussion.created_at,
            author=to_user_public(current_user),
        )
    }


@router.post("/{community_id}/join", response_model=dict)
async def join_community(
    community_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Community).options(selectinload(Community.members)).where(Community.id == community_id)
    )
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    if current_user not in community.members:
        community.members.append(current_user)
    return {"message": "Joined community"}


@router.post("/{community_id}/leave", response_model=dict)
async def leave_community(
    community_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Community).options(selectinload(Community.members)).where(Community.id == community_id)
    )
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    if current_user in community.members:
        community.members.remove(current_user)
    return {"message": "Left community"}
