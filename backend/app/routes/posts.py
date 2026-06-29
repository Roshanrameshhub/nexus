from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser, get_current_user_optional
from app.models.comment import Comment
from app.models.connection import Connection, ConnectionStatus
from app.models.follow import Follow
from app.models.user import User, UserRole
from app.models.post import Post, PostLike, PollVote, PostType
from app.models.platform import PlatformRole
from app.models.notification import Notification
from app.schemas.post import (
    PostCreate,
    PostResponse,
    PostUpdate,
    PostListResponse,
    PollDetailsResponse,
    PollOptionResponse,
    PollVoteRequest,
)
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.auth import MessageResponse
from app.services.ecosystem_service import (
    apply_ecosystem_base_filter,
    apply_ecosystem_category_filter,
    can_create_ecosystem_post,
    ecosystem_posts_where,
)
from app.services.feed_ranking_service import FeedScope, fetch_ranked_feed_posts
from app.services.media_service import collect_post_media_urls
from app.services.storage_service import storage_service
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/posts", tags=["Posts"])

LEGACY_CATEGORY_FILTERS = frozenset({"following", "startups", "ecosystem", "ai", "hiring", "funding"})


def _build_poll_response(
    post: Post,
    vote_counts: dict[str, int],
    user_vote_option_id: str | None,
) -> PollDetailsResponse | None:
    if not post.poll_details or not isinstance(post.poll_details, dict):
        return None
    raw_options = post.poll_details.get("options") or []
    if not isinstance(raw_options, list):
        return None
    total = sum(vote_counts.values())
    options: list[PollOptionResponse] = []
    for opt in raw_options:
        if not isinstance(opt, dict):
            continue
        opt_id = str(opt.get("id", ""))
        text = str(opt.get("text", "")).strip()
        if not opt_id or not text:
            continue
        count = vote_counts.get(opt_id, 0)
        pct = round((count / total) * 100, 1) if total > 0 else 0.0
        options.append(
            PollOptionResponse(
                id=opt_id,
                text=text,
                vote_count=count,
                percentage=pct,
            )
        )
    if not options:
        return None
    return PollDetailsResponse(
        options=options,
        total_votes=total,
        user_vote_option_id=user_vote_option_id,
    )


async def _load_poll_enrichment(
    db: AsyncSession,
    posts: list[Post],
    user_id: UUID | None,
) -> dict[UUID, tuple[dict[str, int], str | None]]:
    poll_post_ids = [
        p.id for p in posts
        if (p.post_type.value if hasattr(p.post_type, "value") else str(p.post_type)) == "poll"
    ]
    if not poll_post_ids:
        return {}

    votes_result = await db.execute(
        select(PollVote).where(PollVote.post_id.in_(poll_post_ids))
    )
    votes = list(votes_result.scalars().all())

    enrichment: dict[UUID, tuple[dict[str, int], str | None]] = {}
    for post_id in poll_post_ids:
        post_votes = [v for v in votes if v.post_id == post_id]
        counts: dict[str, int] = {}
        user_vote: str | None = None
        for vote in post_votes:
            counts[vote.option_id] = counts.get(vote.option_id, 0) + 1
            if user_id and vote.user_id == user_id:
                user_vote = vote.option_id
        enrichment[post_id] = (counts, user_vote)
    return enrichment


def _build_post_response(
    post: Post,
    user_id: UUID | None,
    liked: bool,
    comments_count: int,
    poll_enrichment: tuple[dict[str, int], str | None] | None = None,
) -> PostResponse:
    poll_response = None
    if poll_enrichment is not None:
        counts, user_vote = poll_enrichment
        poll_response = _build_poll_response(post, counts, user_vote)
    elif post.poll_details:
        poll_response = _build_poll_response(post, {}, None)

    author = to_user_public(post.author)
    if getattr(post, "is_official", False) and getattr(post, "official_label", None):
        author = author.model_copy(update={"name": post.official_label})

    return PostResponse(
        id=post.id,
        content=post.content,
        image_url=post.image_url,
        media=post.media or [],
        post_type=post.post_type.value if hasattr(post.post_type, "value") else post.post_type,
        likes_count=post.likes_count,
        reactions_count=post.reactions_count or 0,
        comments_count=comments_count,
        shares_count=post.shares_count or 0,
        views_count=post.views_count or 0,
        opportunity_details=post.opportunity_details,
        poll_details=poll_response,
        is_official=bool(getattr(post, "is_official", False)),
        official_label=getattr(post, "official_label", None),
        created_at=post.created_at,
        author=author,
        liked=liked,
    )


async def _build_feed_responses(
    db: AsyncSession,
    posts: list[Post],
    user_id: UUID | None,
) -> list[PostResponse]:
    if not posts:
        return []

    poll_data = await _load_poll_enrichment(db, posts, user_id)
    responses: list[PostResponse] = []

    liked_ids: set[UUID] = set()
    if user_id:
        like_result = await db.execute(
            select(PostLike.post_id).where(
                PostLike.user_id == user_id,
                PostLike.post_id.in_([p.id for p in posts]),
            )
        )
        liked_ids = set(like_result.scalars().all())

    for post in posts:
        cc = await db.execute(
            select(func.count()).select_from(Comment).where(Comment.post_id == post.id)
        )
        responses.append(
            _build_post_response(
                post,
                user_id,
                post.id in liked_ids,
                cc.scalar() or 0,
                poll_data.get(post.id),
            )
        )
    return responses


async def _get_ranked_feed(
    db: AsyncSession,
    current_user: User | None,
    *,
    scope: FeedScope,
    post_type: str | None,
    page: int,
    limit: int,
) -> PostListResponse:
    ranked = await fetch_ranked_feed_posts(
        db,
        current_user,
        scope=scope,
        post_type=post_type,
    )
    total = len(ranked)
    offset = (page - 1) * limit
    page_posts = ranked[offset : offset + limit]
    user_id = current_user.id if current_user else None
    responses = await _build_feed_responses(db, page_posts, user_id)
    return PostListResponse(
        posts=responses,
        page=page,
        limit=limit,
        total=total,
        has_more=(offset + limit) < total,
    )


@router.get("", response_model=PostListResponse)
async def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: str | None = Query(None, alias="filter"),
    feed_scope: str | None = Query(None),
    post_type: str | None = Query(None),
    ecosystem_category: str | None = Query(None),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
    db: AsyncSession = Depends(get_db),
):
    filter_value = category.lower() if category else None

    if filter_value not in LEGACY_CATEGORY_FILTERS:
        scope: FeedScope = "all"
        if feed_scope in ("all", "connections", "my_posts"):
            scope = feed_scope  # type: ignore[assignment]
        elif filter_value == "connections":
            scope = "connections"
        elif filter_value == "my_posts":
            scope = "my_posts"
        return await _get_ranked_feed(
            db,
            current_user,
            scope=scope,
            post_type=post_type,
            page=page,
            limit=limit,
        )

    offset = (page - 1) * limit
    query = select(Post).options(selectinload(Post.author)).order_by(Post.created_at.desc())

    if post_type:
        try:
            query = query.where(Post.post_type == PostType(post_type))
        except ValueError:
            pass

    if category:
        filter_value = category.lower()
        if filter_value == "following" and current_user:
            query = query.join(User, Post.user_id == User.id).join(
                Follow,
                and_(Follow.followee_id == User.id, Follow.follower_id == current_user.id),
            )
        elif filter_value == "connections" and current_user:
            query = query.join(User, Post.user_id == User.id).join(
                Connection,
                and_(
                    Connection.status == ConnectionStatus.accepted,
                    or_(
                        and_(
                            Connection.sender_id == current_user.id,
                            Connection.receiver_id == User.id,
                        ),
                        and_(
                            Connection.sender_id == User.id,
                            Connection.receiver_id == current_user.id,
                        ),
                    ),
                ),
            )
        elif filter_value in ("startups", "ecosystem"):
            query = apply_ecosystem_base_filter(query)
            query = apply_ecosystem_category_filter(query, ecosystem_category)
        elif filter_value == "ai":
            query = query.where(
                or_(
                    Post.content.ilike("%ai%"),
                    Post.content.ilike("%machine learning%"),
                    Post.content.ilike("%gpt%"),
                )
            )
        elif filter_value == "hiring":
            query = query.where(
                or_(
                    Post.content.ilike("%hiring%"),
                    Post.content.ilike("%job%"),
                    Post.content.ilike("%recruit%"),
                )
            )
        elif filter_value == "funding":
            query = query.where(
                or_(
                    Post.content.ilike("%funding%"),
                    Post.content.ilike("%raise%"),
                    Post.content.ilike("%investment%"),
                )
            )

    count_query = select(func.count()).select_from(Post)
    if post_type:
        try:
            count_query = count_query.where(Post.post_type == PostType(post_type))
        except ValueError:
            pass
    if category and category.lower() == "following" and current_user:
        count_query = select(func.count()).select_from(Post).join(
            User,
            Post.user_id == User.id,
        ).join(
            Follow,
            and_(Follow.followee_id == User.id, Follow.follower_id == current_user.id),
        )
    elif category and category.lower() == "connections" and current_user:
        count_query = select(func.count()).select_from(Post).join(
            User,
            Post.user_id == User.id,
        ).join(
            Connection,
            and_(
                Connection.status == ConnectionStatus.accepted,
                or_(
                    and_(
                        Connection.sender_id == current_user.id,
                        Connection.receiver_id == User.id,
                    ),
                    and_(
                        Connection.sender_id == User.id,
                        Connection.receiver_id == current_user.id,
                    ),
                ),
            ),
        )
    elif category and category.lower() in ("startups", "ecosystem"):
        count_query = select(func.count()).select_from(Post).join(User, Post.user_id == User.id)
        count_query = count_query.where(ecosystem_posts_where())
        count_query = apply_ecosystem_category_filter(count_query, ecosystem_category)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query.offset(offset).limit(limit))
    page_posts = list(result.scalars().all())
    user_id = current_user.id if current_user else None
    responses = await _build_feed_responses(db, page_posts, user_id)

    return PostListResponse(
        posts=responses,
        page=page,
        limit=limit,
        total=total,
        has_more=(offset + limit) < total,
    )


@router.get("/{post_id}", response_model=dict)
async def get_post(
    post_id: UUID,
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).options(selectinload(Post.author)).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    liked = False
    if current_user:
        like_check = await db.execute(
            select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == current_user.id)
        )
        liked = like_check.scalar_one_or_none() is not None
    cc = await db.execute(select(func.count()).select_from(Comment).where(Comment.post_id == post.id))
    poll_data = await _load_poll_enrichment(db, [post], current_user.id if current_user else None)
    return {
        "post": _build_post_response(
            post,
            current_user.id if current_user else None,
            liked,
            cc.scalar() or 0,
            poll_data.get(post.id),
        )
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_post(body: PostCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    post_type = body.post_type or "text"
    if not can_create_ecosystem_post(current_user.role, post_type):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your role cannot create this type of ecosystem post",
        )

    opportunity_data = None
    if post_type == "opportunity":
        if not body.opportunity_details:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opportunity posts require opportunity_details",
            )
        opportunity_data = body.opportunity_details.model_dump()

    poll_data = None
    if post_type == "poll":
        if not body.poll_details or len(body.poll_details.options) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Poll posts require at least 2 options",
            )
        options = [
            {"id": opt.id, "text": opt.text.strip()}
            for opt in body.poll_details.options
            if opt.text.strip()
        ]
        if len(options) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Poll posts require at least 2 non-empty options",
            )
        poll_data = {"options": options}

    post = Post(
        user_id=current_user.id,
        content=body.content,
        post_type=post_type,
        media=body.media or [],
        image_url=body.media[0] if body.media else None,
        hashtags=body.hashtags or [],
        mentions=body.mentions or [],
        opportunity_details=opportunity_data,
        poll_details=poll_data,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post, ["author"])
    return {"post": _build_post_response(post, current_user.id, False, 0, ({}, None) if poll_data else None)}


@router.post("/{post_id}/like", response_model=dict)
async def like_post(post_id: UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    existing = await db.execute(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user.id)
    )
    like = existing.scalar_one_or_none()
    if like:
        await db.delete(like)
        post.likes_count = max(0, post.likes_count - 1)
        liked = False
    else:
        db.add(PostLike(post_id=post_id, user_id=current_user.id))
        post.likes_count += 1
        liked = True
        if post.user_id != current_user.id:
            db.add(
                Notification(
                    user_id=post.user_id,
                    type="like",
                    content=f"{current_user.name} liked your post",
                )
            )

    await db.flush()
    return {"liked": liked, "likes_count": post.likes_count}


@router.post("/{post_id}/poll-vote", response_model=dict)
async def vote_on_poll(
    post_id: UUID,
    body: PollVoteRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).options(selectinload(Post.author)).where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    post_type = post.post_type.value if hasattr(post.post_type, "value") else str(post.post_type)
    if post_type != "poll":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This post is not a poll")

    if not post.poll_details or not isinstance(post.poll_details, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Poll has no options")

    valid_ids = {
        str(opt.get("id"))
        for opt in (post.poll_details.get("options") or [])
        if isinstance(opt, dict) and opt.get("id")
    }
    if body.option_id not in valid_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid poll option")

    existing = await db.execute(
        select(PollVote).where(PollVote.post_id == post_id, PollVote.user_id == current_user.id)
    )
    vote = existing.scalar_one_or_none()
    if vote:
        if vote.option_id == body.option_id:
            poll_data = await _load_poll_enrichment(db, [post], current_user.id)
            return {
                "poll_details": _build_poll_response(
                    post,
                    poll_data.get(post.id, ({}, None))[0],
                    body.option_id,
                )
            }
        vote.option_id = body.option_id
    else:
        db.add(PollVote(post_id=post_id, user_id=current_user.id, option_id=body.option_id))

    await db.flush()
    poll_data = await _load_poll_enrichment(db, [post], current_user.id)
    counts, user_vote = poll_data.get(post.id, ({}, None))
    return {"poll_details": _build_poll_response(post, counts, user_vote)}


@router.patch("/{post_id}", response_model=dict)
async def update_post(
    post_id: UUID,
    body: PostUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Post).options(selectinload(Post.author)).where(Post.id == post_id)
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if body.content is not None:
        post.content = body.content
    if body.media is not None:
        post.media = body.media
        post.image_url = body.media[0] if body.media else None
    await db.flush()
    cc = await db.execute(select(func.count()).select_from(Comment).where(Comment.post_id == post.id))
    return {"post": _build_post_response(post, current_user.id, False, cc.scalar() or 0)}


@router.delete("/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    is_admin = getattr(current_user, "platform_role", None) == PlatformRole.SUPER_ADMIN.value
    if post.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    media_urls = collect_post_media_urls(post.media, post.image_url)
    await db.delete(post)
    storage_service.delete_media_urls(media_urls)
    return MessageResponse(message="Post deleted")


@router.post("/{post_id}/comments", response_model=dict, status_code=status.HTTP_201_CREATED)
async def comment_on_post(
    post_id: UUID,
    body: CommentCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Post).where(Post.id == post_id))
    post_row = result.scalar_one_or_none()
    if not post_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    comment = Comment(post_id=post_id, user_id=current_user.id, content=body.content)
    db.add(comment)
    if post_row.user_id != current_user.id:
        db.add(
            Notification(
                user_id=post_row.user_id,
                type="comment",
                content=f"{current_user.name} commented on your post",
            )
        )
    await db.flush()
    await db.refresh(comment)
    comment.author = current_user
    return {
        "comment": CommentResponse(
            id=comment.id,
            content=comment.content,
            created_at=comment.created_at,
            author=to_user_public(current_user),
        )
    }
