from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.comment import Comment
from app.models.post import Post
from app.models.notification import Notification
from app.schemas.comment import CommentCreate, CommentResponse, CommentUpdate
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/comments", tags=["Comments"])


@router.get("/posts/{post_id}", response_model=dict)
async def get_post_comments(
    post_id: UUID,
    sort: str = Query("recent", regex="^(recent|top)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    offset = (page - 1) * limit
    query = select(Comment).where(Comment.post_id == post_id, Comment.parent_comment_id.is_(None))

    if sort == "top":
        query = query.order_by(Comment.reactions_count.desc(), Comment.created_at.desc())
    else:
        query = query.order_by(Comment.created_at.desc())

    result = await db.execute(
        query.options(selectinload(Comment.author)).offset(offset).limit(limit)
    )
    comments = result.scalars().all()

    total_result = await db.execute(
        select(func.count()).select_from(Comment).where(Comment.post_id == post_id, Comment.parent_comment_id.is_(None))
    )
    total = total_result.scalar() or 0

    responses = [
        CommentResponse(
            id=c.id,
            content=c.content,
            created_at=c.created_at,
            author=to_user_public(c.author),
            reactions_count=c.reactions_count,
            replies_count=len(c.replies) if c.replies else 0,
        )
        for c in comments
    ]

    return {
        "comments": responses,
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": (offset + limit) < total,
    }


@router.post("/{comment_id}/replies", response_model=dict, status_code=status.HTTP_201_CREATED)
async def reply_to_comment(
    comment_id: UUID,
    body: CommentCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    parent = await db.get(Comment, comment_id)
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    reply = Comment(
        post_id=parent.post_id,
        user_id=current_user.id,
        parent_comment_id=comment_id,
        content=body.content,
    )
    db.add(reply)

    if parent.user_id != current_user.id:
        db.add(
            Notification(
                user_id=parent.user_id,
                type="comment",
                content=f"{current_user.name} replied to your comment",
            )
        )

    await db.flush()
    await db.refresh(reply, ["author"])
    return {
        "reply": CommentResponse(
            id=reply.id,
            content=reply.content,
            created_at=reply.created_at,
            author=to_user_public(reply.author),
            reactions_count=0,
            replies_count=0,
        )
    }


@router.get("/{comment_id}/replies", response_model=dict)
async def get_comment_replies(
    comment_id: UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    offset = (page - 1) * limit
    result = await db.execute(
        select(Comment)
        .where(Comment.parent_comment_id == comment_id)
        .options(selectinload(Comment.author))
        .order_by(Comment.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    replies = result.scalars().all()

    total_result = await db.execute(
        select(func.count()).select_from(Comment).where(Comment.parent_comment_id == comment_id)
    )
    total = total_result.scalar() or 0

    responses = [
        CommentResponse(
            id=r.id,
            content=r.content,
            created_at=r.created_at,
            author=to_user_public(r.author),
            reactions_count=r.reactions_count,
            replies_count=0,
        )
        for r in replies
    ]

    return {
        "replies": responses,
        "page": page,
        "limit": limit,
        "total": total,
        "has_more": (offset + limit) < total,
    }


@router.put("/{comment_id}", response_model=dict)
async def edit_comment(
    comment_id: UUID,
    body: CommentUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")

    comment.content = body.content
    await db.flush()
    await db.refresh(comment, ["author"])

    return {
        "comment": CommentResponse(
            id=comment.id,
            content=comment.content,
            created_at=comment.created_at,
            author=to_user_public(comment.author),
            reactions_count=comment.reactions_count,
            replies_count=len(comment.replies) if comment.replies else 0,
        )
    }


@router.delete("/{comment_id}", response_model=dict)
async def delete_comment(
    comment_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")

    await db.delete(comment)
    await db.flush()
    return {"deleted": True}
