from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.post import Post
from app.models.comment import Comment
from app.models.message import Message
from app.models.reaction import PostReaction, CommentReaction, MessageReaction, ReactionType
from app.models.notification import Notification
from app.schemas.reaction import ReactionCreate, ReactionResponse, ReactionBreakdown
from app.utils.user_mapper import to_user_public

router = APIRouter(prefix="/reactions", tags=["Reactions"])


@router.post("/posts/{post_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def react_to_post(
    post_id: UUID,
    body: ReactionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    existing = await db.execute(
        select(PostReaction).where(
            PostReaction.post_id == post_id,
            PostReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        reaction.reaction_type = body.reaction_type
    else:
        reaction = PostReaction(
            post_id=post_id,
            user_id=current_user.id,
            reaction_type=body.reaction_type,
        )
        db.add(reaction)
        post.reactions_count += 1

        if post.user_id != current_user.id:
            db.add(
                Notification(
                    user_id=post.user_id,
                    type="reaction",
                    content=f"{current_user.name} reacted {body.reaction_type} to your post",
                )
            )

    await db.flush()
    return {"reaction": {"type": body.reaction_type, "post_id": str(post_id)}}


@router.delete("/posts/{post_id}", response_model=dict)
async def remove_reaction_from_post(
    post_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    existing = await db.execute(
        select(PostReaction).where(
            PostReaction.post_id == post_id,
            PostReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        await db.delete(reaction)
        post.reactions_count = max(0, post.reactions_count - 1)
    
    await db.flush()
    return {"removed": True}


@router.get("/posts/{post_id}", response_model=dict)
async def get_post_reactions(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    reactions_result = await db.execute(
        select(PostReaction).where(PostReaction.post_id == post_id)
    )
    reactions = reactions_result.scalars().all()

    breakdown = ReactionBreakdown()
    for reaction in reactions:
        if reaction.reaction_type == "like":
            breakdown.like += 1
        elif reaction.reaction_type == "celebrate":
            breakdown.celebrate += 1
        elif reaction.reaction_type == "insightful":
            breakdown.insightful += 1
        elif reaction.reaction_type == "innovative":
            breakdown.innovative += 1
        elif reaction.reaction_type == "support":
            breakdown.support += 1
        elif reaction.reaction_type == "useful":
            breakdown.useful += 1

    return {"breakdown": breakdown.model_dump()}


@router.post("/comments/{comment_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def react_to_comment(
    comment_id: UUID,
    body: ReactionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    existing = await db.execute(
        select(CommentReaction).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        reaction.reaction_type = body.reaction_type
    else:
        reaction = CommentReaction(
            comment_id=comment_id,
            user_id=current_user.id,
            reaction_type=body.reaction_type,
        )
        db.add(reaction)
        comment.reactions_count += 1

    await db.flush()
    return {"reaction": {"type": body.reaction_type, "comment_id": str(comment_id)}}


@router.delete("/comments/{comment_id}", response_model=dict)
async def remove_reaction_from_comment(
    comment_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    existing = await db.execute(
        select(CommentReaction).where(
            CommentReaction.comment_id == comment_id,
            CommentReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        await db.delete(reaction)
        comment.reactions_count = max(0, comment.reactions_count - 1)
    
    await db.flush()
    return {"removed": True}


@router.post("/messages/{message_id}", response_model=dict, status_code=status.HTTP_201_CREATED)
async def react_to_message(
    message_id: UUID,
    body: ReactionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    message = await db.get(Message, message_id)
    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        reaction.reaction_type = body.reaction_type
    else:
        reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            reaction_type=body.reaction_type,
        )
        db.add(reaction)

    await db.flush()
    return {"reaction": {"type": body.reaction_type, "message_id": str(message_id)}}


@router.delete("/messages/{message_id}", response_model=dict)
async def remove_reaction_from_message(
    message_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
        )
    )
    reaction = existing.scalar_one_or_none()

    if reaction:
        await db.delete(reaction)
    
    await db.flush()
    return {"removed": True}
