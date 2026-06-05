import re
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.post import Post
from app.models.startup import Startup
from app.models.user import User
from app.routes.posts import _build_post_response
from app.schemas.startup import StartupResponse
from app.utils.user_mapper import to_user_public
from app.services.news_service import news_service

router = APIRouter(prefix="/topics", tags=["Topics"])


def _clean_topic_name(slug: str) -> str:
    return slug.replace("-", " ").strip()


def _extract_topic_query(text: str) -> List[str]:
    topics = set(re.findall(r"#([a-zA-Z0-9_-]+)", text))
    return [topic.replace("_", " ").title() for topic in topics]


@router.get("/{slug}")
async def get_topic_details(slug: str, db: AsyncSession = Depends(get_db)):
    topic = _clean_topic_name(slug)
    pattern = f"%{topic}%"

    users_result = await db.execute(
        select(User).where(
            or_(
                User.name.ilike(pattern),
                User.username.ilike(pattern),
                User.bio.ilike(pattern),
            )
        ).limit(10)
    )

    startups_result = await db.execute(
        select(Startup).where(
            or_(
                Startup.name.ilike(pattern),
                Startup.description.ilike(pattern),
                Startup.industry.ilike(pattern),
                Startup.stage.ilike(pattern),
            )
        ).limit(10)
    )

    posts_result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.content.ilike(pattern))
        .order_by(Post.created_at.desc())
        .limit(12)
    )

    articles = await news_service.fetch_gnews(topic, 6)
    devto_articles = await news_service.fetch_devto(topic, 1, 6)
    related_topics = [t for t in await news_service.fetch_trending_topics(10) if topic.lower() in t["name"].lower()][:6]

    return {
        "topic": topic.title(),
        "users": [to_user_public(user) for user in users_result.scalars().all()],
        "startups": [StartupResponse.model_validate(startup) for startup in startups_result.scalars().all()],
        "posts": [_build_post_response(post, None, False, 0) for post in posts_result.scalars().all()],
        "news": articles + devto_articles,
        "related_topics": related_topics,
    }
