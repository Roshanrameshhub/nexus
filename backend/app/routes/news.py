from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.news_bookmark import NewsBookmark
from app.models.news_interaction import NewsLike, NewsComment
from app.services.news_service import news_service

router = APIRouter(prefix="/news", tags=["News"])

RESERVED = {
    "trending", "ai", "startups", "devto", "search",
    "trending-topics", "recommendations", "bookmarks", "articles",
    "technology", "funding", "cybersecurity", "cloud", "saas",
}

# ---------- strict category queries ----------

CATEGORY_QUERIES = {
    "ai": "artificial intelligence machine learning",
    "startups": "startup ecosystem founders",
    "technology": "technology innovation software",
    "funding": "startup funding investment venture capital",
    "cybersecurity": "cybersecurity data breach security",
    "cloud": "cloud computing AWS Azure infrastructure",
    "saas": "SaaS software as a service",
}


@router.get("/trending")
async def get_trending(limit: int = Query(10, ge=1, le=50)):
    articles = await news_service.fetch_gnews("technology startup", limit)
    return {"articles": articles}


@router.get("/ai")
async def get_ai_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["ai"], limit)
    return {"articles": articles}


@router.get("/startups")
async def get_startup_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["startups"], limit)
    return {"articles": articles}


@router.get("/technology")
async def get_technology_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["technology"], limit)
    return {"articles": articles}


@router.get("/funding")
async def get_funding_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["funding"], limit)
    return {"articles": articles}


@router.get("/cybersecurity")
async def get_cybersecurity_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["cybersecurity"], limit)
    return {"articles": articles}


@router.get("/cloud")
async def get_cloud_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["cloud"], limit)
    return {"articles": articles}


@router.get("/saas")
async def get_saas_news(page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(CATEGORY_QUERIES["saas"], limit)
    return {"articles": articles}


@router.get("/devto")
async def get_devto(tag: Optional[str] = None, page: int = 1, limit: int = 20):
    articles = await news_service.fetch_devto(tag, page, limit)
    return {"articles": articles}


@router.get("/trending-topics")
async def trending_topics():
    return {"topics": await news_service.fetch_trending_topics(10)}


@router.get("/recommendations")
async def news_recommendations(current_user: CurrentUser):
    role = current_user.role.value if hasattr(current_user.role, "value") else current_user.role

    query = "technology startup"
    if role == "founder":
        query = "startups funding venture capital"
    elif role == "developer":
        query = "programming AI cloud open source"
    elif role == "investor":
        query = "venture capital startup funding market trends"
    elif role == "mentor":
        query = "leadership technology industry insights startup"
    elif role == "student":
        query = "learning resources emerging technologies career student coding"
    elif role == "executive":
        query = "business technology market trends leadership"

    articles = await news_service.fetch_gnews(query, 10)
    return {"articles": articles}


@router.get("/search")
async def search_news(q: str = Query(...), page: int = 1, limit: int = 20):
    articles = await news_service.fetch_gnews(q, limit)
    return {"articles": articles, "total": len(articles)}


@router.get("/bookmarks")
async def get_bookmarks(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NewsBookmark)
        .where(NewsBookmark.user_id == current_user.id)
        .order_by(NewsBookmark.created_at.desc())
    )
    ids = {b.article_id for b in result.scalars().all()}
    articles = await news_service.fetch_gnews("technology", 30)
    filtered = [a for a in articles if a["id"] in ids]
    return {"articles": filtered}


@router.get("/articles/{article_id}")
async def get_article(article_id: str):
    articles = await news_service.fetch_gnews("technology", 30)
    for a in articles:
        if a["id"] == article_id:
            return {"article": a}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")


# ---------- Article interactions ----------


class ArticleCommentBody(BaseModel):
    content: str


@router.post("/articles/{article_id}/like")
async def like_article(article_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(NewsLike).where(
            NewsLike.user_id == current_user.id,
            NewsLike.article_id == article_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(NewsLike(user_id=current_user.id, article_id=article_id))
    return {"message": "Liked", "liked": True}


@router.delete("/articles/{article_id}/like")
async def unlike_article(article_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NewsLike).where(
            NewsLike.user_id == current_user.id,
            NewsLike.article_id == article_id,
        )
    )
    bm = result.scalar_one_or_none()
    if bm:
        await db.delete(bm)
    return {"message": "Unliked", "liked": False}


@router.get("/articles/{article_id}/likes")
async def get_article_likes(article_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count()).select_from(NewsLike).where(NewsLike.article_id == article_id)
    )
    count = result.scalar() or 0
    return {"article_id": article_id, "likes_count": count}


@router.get("/articles/{article_id}/comments")
async def get_article_comments(article_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NewsComment)
        .where(NewsComment.article_id == article_id)
        .order_by(NewsComment.created_at.asc())
    )
    comments = result.scalars().all()
    
    # Format response with user details
    formatted_comments = []
    for c in comments:
        user = c.user
        formatted_comments.append({
            "id": str(c.id),
            "content": c.content,
            "created_at": c.created_at.isoformat(),
            "author": {
                "id": str(user.id),
                "name": user.name,
                "role": user.role.value if hasattr(user.role, "value") else user.role,
                "avatar_url": getattr(user, "avatar_url", None)
            }
        })
    return {"comments": formatted_comments}


@router.post("/articles/{article_id}/comments")
async def create_article_comment(
    article_id: str,
    body: ArticleCommentBody,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db)
):
    comment = NewsComment(
        user_id=current_user.id,
        article_id=article_id,
        content=body.content
    )
    db.add(comment)
    await db.flush()
    
    return {
        "message": "Comment added",
        "comment": {
            "id": str(comment.id),
            "content": comment.content,
            "created_at": comment.created_at.isoformat(),
            "author": {
                "id": str(current_user.id),
                "name": current_user.name,
                "role": current_user.role.value if hasattr(current_user.role, "value") else current_user.role,
                "avatar_url": getattr(current_user, "avatar_url", None)
            }
        }
    }



@router.post("/articles/{article_id}/bookmark")
async def bookmark(article_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(NewsBookmark).where(
            NewsBookmark.user_id == current_user.id,
            NewsBookmark.article_id == article_id,
        )
    )
    if not existing.scalar_one_or_none():
        db.add(NewsBookmark(user_id=current_user.id, article_id=article_id))
    return {"message": "Bookmarked"}


@router.delete("/articles/{article_id}/bookmark")
async def remove_bookmark(article_id: str, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(NewsBookmark).where(
            NewsBookmark.user_id == current_user.id,
            NewsBookmark.article_id == article_id,
        )
    )
    bookmark = result.scalar_one_or_none()
    if bookmark:
        await db.delete(bookmark)
    return {"message": "Bookmark removed"}


@router.get("/{category}")
async def get_by_category(category: str, page: int = 1, limit: int = 20):
    if category in RESERVED:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    # Query Dev.to for coding/programming categories, GNews for others
    if category in ["web-development", "programming", "open-source"]:
        tag_map = {
            "web-development": "webdev",
            "programming": "programming",
            "open-source": "opensource"
        }
        tag = tag_map.get(category, "programming")
        articles = await news_service.fetch_devto(tag, page, limit)
    else:
        query = CATEGORY_QUERIES.get(category, category.replace("-", " "))
        articles = await news_service.fetch_gnews(query, limit)

    return {"articles": articles, "total": len(articles), "hasMore": False, "page": page, "limit": limit}

