from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.post import Post
from app.models.bookmark import Bookmark, Repost
from app.schemas.bookmark import BookmarkResponse, RepostResponse, RepostCreate
from app.schemas.post import PostResponse

router = APIRouter(prefix="/bookmarks", tags=["Bookmarks"])


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def save_post(
    post_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    existing = await db.execute(
        select(Bookmark).where(
            Bookmark.post_id == post_id,
            Bookmark.user_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Post already bookmarked")

    bookmark = Bookmark(post_id=post_id, user_id=current_user.id)
    db.add(bookmark)
    await db.flush()
    return {"bookmarked": True, "post_id": str(post_id)}


@router.delete("/{post_id}", response_model=dict)
async def unsave_post(
    post_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Bookmark).where(
            Bookmark.post_id == post_id,
            Bookmark.user_id == current_user.id,
        )
    )
    bookmark = existing.scalar_one_or_none()
    if not bookmark:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")

    await db.delete(bookmark)
    await db.flush()
    return {"removed": True}


@router.get("", response_model=dict)
async def get_saved_posts(
    page: int = 1,
    limit: int = 20,
    current_user: CurrentUser = None,
    db: AsyncSession = Depends(get_db),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    offset = (page - 1) * limit
    result = await db.execute(
        select(Bookmark)
        .where(Bookmark.user_id == current_user.id)
        .order_by(Bookmark.created_at.desc())
        .offset(offset)
        .limit(limit)
        .options(selectinload(Bookmark.post))
    )
    bookmarks = result.scalars().all()

    total_result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == current_user.id)
    )
    total = len(total_result.scalars().all())

    return {
        "bookmarks": [{"id": str(b.id), "post": b.post} for b in bookmarks],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.post("/reposts", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_repost(
    body: RepostCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    post = await db.get(Post, body.post_id)
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    repost = Repost(
        original_post_id=body.post_id,
        user_id=current_user.id,
        caption=body.caption,
    )
    db.add(repost)
    post.shares_count += 1
    await db.flush()
    return {"reposted": True, "post_id": str(body.post_id)}


@router.get("/reposts/{post_id}", response_model=list)
async def get_reposts(
    post_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Repost)
        .where(Repost.original_post_id == post_id)
        .order_by(Repost.created_at.desc())
    )
    reposts = result.scalars().all()
    return reposts
