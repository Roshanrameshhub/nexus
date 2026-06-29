import re
from collections import Counter
from fastapi import APIRouter, Depends, Query
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

router = APIRouter(prefix="/search", tags=["Search"])

SEARCH_TOPICS = [
    "AI Agents",
    "GPT-5",
    "LangChain",
    "OpenAI",
    "Apple WWDC",
    "NVIDIA",
    "React",
    "Next.js",
    "Rust",
    "Python",
    "Startup Funding",
    "Series A",
    "Cloud",
    "Cybersecurity",
    "Product Launch",
]


def _normalize_topic(name: str, count: int) -> dict[str, object]:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    is_hot = count >= 2
    change = min(99, int((count / (count + 1)) * 100))
    category = "ai" if any(keyword in name.lower() for keyword in ["ai", "gpt", "langchain", "openai"]) else (
        "funding" if any(keyword in name.lower() for keyword in ["funding", "series a", "venture"]) else "startups"
    )
    return {
        "id": slug,
        "name": name,
        "category": category,
        "mentions": count * 100,
        "change": change,
        "isHot": is_hot,
    }


@router.get("")
async def search_everywhere(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q}%"
    user_result = await db.execute(
        select(User)
        .where(
            or_(
                User.name.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
        .limit(10)
    )
    startup_result = await db.execute(
        select(Startup)
        .where(
            or_(
                Startup.name.ilike(pattern),
                Startup.description.ilike(pattern),
                Startup.industry.ilike(pattern),
                Startup.stage.ilike(pattern),
            )
        )
        .limit(10)
    )
    post_result = await db.execute(
        select(Post)
        .options(selectinload(Post.author))
        .where(Post.content.ilike(pattern))
        .order_by(Post.created_at.desc())
        .limit(10)
    )

    topics = [
        _normalize_topic(topic, 3)
        for topic in SEARCH_TOPICS
        if q.lower() in topic.lower()
    ]
    if not topics:
        topics = [{
            "id": re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-"),
            "name": q.title(),
            "category": "topic",
            "mentions": 10,
            "change": 8,
            "isHot": False,
        }]

    return {
        "users": [to_user_public(user) for user in user_result.scalars().all()],
        "startups": [StartupResponse.model_validate(startup) for startup in startup_result.scalars().all()],
        "posts": [_build_post_response(post, None, False, 0) for post in post_result.scalars().all()],
        "topics": topics,
    }
