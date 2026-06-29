from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser, get_current_user_optional
from app.models.community import (
    Community,
    CommunityDiscussion,
    DiscussionComment,
    DiscussionLike,
    community_members,
)
from app.models.user import User
from app.schemas.community import (
    CommunityActivityMetrics,
    CommunityCreate,
    CommunityResponse,
    DiscussionCommentCreate,
    DiscussionCommentResponse,
    DiscussionCreate,
    DiscussionResponse,
)
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/communities", tags=["Communities"])


async def _member_count(db: AsyncSession, community_id: UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(community_members).where(community_members.c.community_id == community_id)
    )
    return result.scalar() or 0


async def _is_member(db: AsyncSession, community_id: UUID, user_id: UUID) -> bool:
    result = await db.execute(
        select(func.count())
        .select_from(community_members)
        .where(community_members.c.community_id == community_id, community_members.c.user_id == user_id)
    )
    return (result.scalar() or 0) > 0


async def _require_membership(db: AsyncSession, community_id: UUID, user: User) -> None:
    if not await _is_member(db, community_id, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Join this community to access discussions and community content",
        )


async def _activity_metrics(db: AsyncSession, community_id: UUID) -> CommunityActivityMetrics:
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    total = await db.execute(
        select(func.count()).select_from(CommunityDiscussion).where(CommunityDiscussion.community_id == community_id)
    )
    recent = await db.execute(
        select(func.count())
        .select_from(CommunityDiscussion)
        .where(CommunityDiscussion.community_id == community_id, CommunityDiscussion.created_at >= week_ago)
    )
    likes = await db.execute(
        select(func.coalesce(func.sum(CommunityDiscussion.likes_count), 0)).where(
            CommunityDiscussion.community_id == community_id
        )
    )
    comments = await db.execute(
        select(func.coalesce(func.sum(CommunityDiscussion.comments_count), 0)).where(
            CommunityDiscussion.community_id == community_id
        )
    )
    return CommunityActivityMetrics(
        total_discussions=total.scalar() or 0,
        discussions_this_week=recent.scalar() or 0,
        total_likes=likes.scalar() or 0,
        total_comments=comments.scalar() or 0,
    )


def _build_discussion_response(
    discussion: CommunityDiscussion,
    author: User | None,
    *,
    liked: bool = False,
    community_name: str | None = None,
) -> DiscussionResponse:
    return DiscussionResponse(
        id=discussion.id,
        community_id=discussion.community_id,
        title=discussion.title,
        content=discussion.content,
        created_at=discussion.created_at,
        author=to_user_public(author) if author else None,
        likes_count=discussion.likes_count,
        comments_count=discussion.comments_count,
        views_count=discussion.views_count,
        shares_count=discussion.shares_count,
        is_pinned=discussion.is_pinned,
        liked=liked,
        community_name=community_name,
    )


async def _build_community_response(
    db: AsyncSession,
    community: Community,
    current_user: User | None = None,
    *,
    include_activity: bool = False,
) -> CommunityResponse:
    member_count = await _member_count(db, community.id)
    is_member = False
    if current_user:
        is_member = await _is_member(db, community.id, current_user.id)
    activity = await _activity_metrics(db, community.id) if include_activity else None
    return CommunityResponse(
        id=community.id,
        name=community.name,
        description=community.description,
        tags=community.tags or [],
        creator_id=community.creator_id,
        member_count=member_count,
        is_member=is_member,
        created_at=community.created_at,
        activity=activity,
    )


@router.get("", response_model=dict)
async def list_communities(
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    result = await db.execute(select(Community).order_by(Community.created_at.desc()))
    communities = []
    for c in result.scalars().all():
        communities.append(await _build_community_response(db, c, current_user))
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
        tags=body.tags or [],
        creator_id=current_user.id,
        members=[current_user],
    )
    db.add(community)
    await db.flush()
    return {
        "community": await _build_community_response(db, community, current_user, include_activity=True)
    }


@router.get("/discussions/{discussion_id}", response_model=dict)
async def get_discussion(
    discussion_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CommunityDiscussion)
        .options(selectinload(CommunityDiscussion.community))
        .where(CommunityDiscussion.id == discussion_id)
    )
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)

    discussion.views_count += 1
    author = await db.get(User, discussion.user_id)
    liked = False
    existing = await db.execute(
        select(DiscussionLike).where(
            DiscussionLike.discussion_id == discussion_id,
            DiscussionLike.user_id == current_user.id,
        )
    )
    liked = existing.scalar_one_or_none() is not None

    return {
        "discussion": _build_discussion_response(
            discussion,
            author,
            liked=liked,
            community_name=discussion.community.name if discussion.community else None,
        )
    }


@router.post("/discussions/{discussion_id}/like", response_model=dict)
async def like_discussion(
    discussion_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityDiscussion).where(CommunityDiscussion.id == discussion_id))
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)

    existing = await db.execute(
        select(DiscussionLike).where(
            DiscussionLike.discussion_id == discussion_id,
            DiscussionLike.user_id == current_user.id,
        )
    )
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        discussion.likes_count = max(0, discussion.likes_count - 1)
        liked = False
    else:
        db.add(DiscussionLike(discussion_id=discussion_id, user_id=current_user.id))
        discussion.likes_count += 1
        liked = True

    await db.flush()
    return {"liked": liked, "likes_count": discussion.likes_count}


@router.post("/discussions/{discussion_id}/share", response_model=dict)
async def share_discussion(
    discussion_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityDiscussion).where(CommunityDiscussion.id == discussion_id))
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)
    discussion.shares_count += 1
    await db.flush()
    return {"shares_count": discussion.shares_count}


@router.get("/discussions/{discussion_id}/comments", response_model=dict)
async def get_discussion_comments(
    discussion_id: UUID,
    current_user: CurrentUser,
    sort: str = Query("recent", pattern="^(recent|top)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityDiscussion).where(CommunityDiscussion.id == discussion_id))
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)

    offset = (page - 1) * limit
    query = select(DiscussionComment).where(
        DiscussionComment.discussion_id == discussion_id,
        DiscussionComment.parent_comment_id.is_(None),
    )
    if sort == "top":
        query = query.order_by(DiscussionComment.created_at.desc())
    else:
        query = query.order_by(DiscussionComment.created_at.desc())

    comments_result = await db.execute(
        query.options(selectinload(DiscussionComment.author), selectinload(DiscussionComment.replies)).offset(offset).limit(limit)
    )
    comments = comments_result.scalars().all()

    total_result = await db.execute(
        select(func.count())
        .select_from(DiscussionComment)
        .where(DiscussionComment.discussion_id == discussion_id, DiscussionComment.parent_comment_id.is_(None))
    )
    total = total_result.scalar() or 0

    return {
        "comments": [
            DiscussionCommentResponse(
                id=c.id,
                content=c.content,
                created_at=c.created_at,
                author=to_user_public(c.author),
                replies_count=len(c.replies) if c.replies else 0,
            )
            for c in comments
        ],
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": (offset + limit) < total,
    }


@router.post("/discussions/{discussion_id}/comments", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_discussion_comment(
    discussion_id: UUID,
    body: DiscussionCommentCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityDiscussion).where(CommunityDiscussion.id == discussion_id))
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)

    comment = DiscussionComment(
        discussion_id=discussion_id,
        user_id=current_user.id,
        content=body.content,
    )
    db.add(comment)
    discussion.comments_count += 1
    await db.flush()
    await db.refresh(comment, ["author"])
    return {
        "comment": DiscussionCommentResponse(
            id=comment.id,
            content=comment.content,
            created_at=comment.created_at,
            author=to_user_public(comment.author),
            replies_count=0,
        )
    }


@router.post("/discussion-comments/{comment_id}/replies", response_model=dict, status_code=status.HTTP_201_CREATED)
async def reply_to_discussion_comment(
    comment_id: UUID,
    body: DiscussionCommentCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    parent = await db.get(DiscussionComment, comment_id)
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    result = await db.execute(select(CommunityDiscussion).where(CommunityDiscussion.id == parent.discussion_id))
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)

    reply = DiscussionComment(
        discussion_id=parent.discussion_id,
        user_id=current_user.id,
        parent_comment_id=comment_id,
        content=body.content,
    )
    db.add(reply)
    discussion.comments_count += 1
    await db.flush()
    await db.refresh(reply, ["author"])
    return {
        "reply": DiscussionCommentResponse(
            id=reply.id,
            content=reply.content,
            created_at=reply.created_at,
            author=to_user_public(reply.author),
            replies_count=0,
        )
    }


@router.get("/discussion-comments/{comment_id}/replies", response_model=dict)
async def get_discussion_comment_replies(
    comment_id: UUID,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    parent = await db.get(DiscussionComment, comment_id)
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    result = await db.execute(select(CommunityDiscussion).where(CommunityDiscussion.id == parent.discussion_id))
    discussion = result.scalar_one_or_none()
    if not discussion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discussion not found")

    await _require_membership(db, discussion.community_id, current_user)

    offset = (page - 1) * limit
    replies_result = await db.execute(
        select(DiscussionComment)
        .where(DiscussionComment.parent_comment_id == comment_id)
        .options(selectinload(DiscussionComment.author))
        .order_by(DiscussionComment.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    replies = replies_result.scalars().all()
    total_result = await db.execute(
        select(func.count())
        .select_from(DiscussionComment)
        .where(DiscussionComment.parent_comment_id == comment_id)
    )
    total = total_result.scalar() or 0

    return {
        "replies": [
            DiscussionCommentResponse(
                id=r.id,
                content=r.content,
                created_at=r.created_at,
                author=to_user_public(r.author),
                replies_count=0,
            )
            for r in replies
        ],
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": (offset + limit) < total,
    }


@router.get("/{community_id}", response_model=dict)
async def get_community(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
):
    result = await db.execute(select(Community).where(Community.id == community_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")
    return {
        "community": await _build_community_response(db, c, current_user, include_activity=True)
    }


@router.get("/{community_id}/discussions", response_model=dict)
async def get_discussions(
    community_id: UUID,
    current_user: CurrentUser,
    sort: str = Query("recent", pattern="^(recent|trending|top)$"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Community).where(Community.id == community_id))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

    await _require_membership(db, community_id, current_user)

    query = select(CommunityDiscussion).where(CommunityDiscussion.community_id == community_id)
    if sort == "trending":
        query = query.order_by(
            CommunityDiscussion.is_pinned.desc(),
            (CommunityDiscussion.likes_count + CommunityDiscussion.comments_count * 2).desc(),
            CommunityDiscussion.created_at.desc(),
        )
    elif sort == "top":
        query = query.order_by(
            CommunityDiscussion.is_pinned.desc(),
            CommunityDiscussion.likes_count.desc(),
            CommunityDiscussion.created_at.desc(),
        )
    else:
        query = query.order_by(CommunityDiscussion.is_pinned.desc(), CommunityDiscussion.created_at.desc())

    discussions_result = await db.execute(query)
    discussions = []
    for d in discussions_result.scalars().all():
        author = await db.get(User, d.user_id)
        liked = False
        existing = await db.execute(
            select(DiscussionLike).where(
                DiscussionLike.discussion_id == d.id,
                DiscussionLike.user_id == current_user.id,
            )
        )
        liked = existing.scalar_one_or_none() is not None
        discussions.append(_build_discussion_response(d, author, liked=liked, community_name=community.name))

    pinned = [d for d in discussions if d.is_pinned]
    trending = sorted(
        discussions,
        key=lambda d: d.likes_count + d.comments_count * 2 + d.views_count,
        reverse=True,
    )[:5]
    recent = sorted(discussions, key=lambda d: d.created_at, reverse=True)[:5]

    return {
        "discussions": discussions,
        "pinned": pinned,
        "trending": trending,
        "recent": recent,
    }


@router.post("/{community_id}/discussions", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_discussion(
    community_id: UUID,
    body: DiscussionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Community).where(Community.id == community_id))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found")

    await _require_membership(db, community_id, current_user)

    discussion = CommunityDiscussion(
        community_id=community_id,
        user_id=current_user.id,
        title=body.title,
        content=body.content,
    )
    db.add(discussion)
    await db.flush()
    return {
        "discussion": _build_discussion_response(
            discussion,
            current_user,
            community_name=community.name,
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
