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
from app.models.post import Post, PostLike
from app.models.notification import Notification
from app.schemas.post import PostCreate, PostResponse, PostUpdate, PostListResponse
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.auth import MessageResponse
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/posts", tags=["Posts"])


def _build_post_response(post: Post, user_id: UUID | None, liked: bool, comments_count: int) -> PostResponse:
    return PostResponse(
        id=post.id,
        content=post.content,
        image_url=post.image_url,
        media=post.media or [],
        post_type=post.post_type.value if hasattr(post.post_type, "value") else post.post_type,
        likes_count=post.likes_count,
        comments_count=comments_count,
        created_at=post.created_at,
        author=to_user_public(post.author),
        liked=liked,
    )


@router.get("", response_model=PostListResponse)
async def get_feed(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: str | None = Query(None, alias="filter"),
    current_user: Annotated[Optional[User], Depends(get_current_user_optional)] = None,
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    query = select(Post).options(selectinload(Post.author)).order_by(Post.created_at.desc())

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
            query = query.join(User, Post.user_id == User.id).where(
                or_(
                    User.role == UserRole.founder,
                    User.role == UserRole.executive
                )
            )
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
        count_query = select(func.count()).select_from(Post).join(
            User,
            Post.user_id == User.id,
        ).where(
            or_(
                User.role == UserRole.founder,
                User.role == UserRole.executive
            )
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(query.offset(offset).limit(limit))
    posts = result.scalars().all()
    user_id = current_user.id if current_user else None

    responses = []
    for post in posts:
        liked = False
        if user_id:
            like_check = await db.execute(
                select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == user_id)
            )
            liked = like_check.scalar_one_or_none() is not None
        cc = await db.execute(select(func.count()).select_from(Comment).where(Comment.post_id == post.id))
        responses.append(_build_post_response(post, user_id, liked, cc.scalar() or 0))

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
    return {"post": _build_post_response(post, current_user.id if current_user else None, liked, cc.scalar() or 0)}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_post(body: PostCreate, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if body.post_type in ["startup_update", "funding", "product_launch"] and role not in ["founder", "executive"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only founders and executives can create ecosystem posts")

    post = Post(
        user_id=current_user.id,
        content=body.content,
        post_type=body.post_type or "text",
        media=body.media or [],
        image_url=body.media[0] if body.media else None,
    )
    db.add(post)
    await db.flush()
    await db.refresh(post, ["author"])
    return {"post": _build_post_response(post, current_user.id, False, 0)}


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
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    await db.delete(post)
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
