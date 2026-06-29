import hashlib
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, List, Optional

import httpx

from app.config.settings import get_settings
import logging

settings = get_settings()

logger = logging.getLogger(__name__)

LANGUAGE_COLORS = {
    "TypeScript": "#3178c6",
    "JavaScript": "#f1e05a",
    "Python": "#3572A5",
    "Rust": "#dea584",
    "Go": "#00ADD8",
}


def _article_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


def _normalize_gnews(article: dict, category: str) -> dict[str, Any]:
    source = article.get("source", {}) or {}
    return {
        "id": _article_id(article.get("url", "")),
        "title": article.get("title", ""),
        "description": article.get("description", ""),
        "content": article.get("content", ""),
        "source": {
            "name": source.get("name", "GNews"),
            "url": source.get("url", ""),
            "icon": None,
        },
        "author": source.get("name", "Unknown"),
        "publishedAt": article.get("publishedAt", datetime.now(timezone.utc).isoformat()),
        "imageUrl": article.get("image"),
        "url": article.get("url", "#"),
        "category": category,
        "tags": ["Technology", "Innovation"],
        "engagement": {"views": 0, "likes": 0, "shares": 0, "comments": 0},
    }


def _normalize_devto(article: dict, category: str = "web-development") -> dict[str, Any]:
    return {
        "id": str(article.get("id", "")),
        "title": article.get("title", ""),
        "description": article.get("description", ""),
        "content": "",
        "source": {"name": "Dev.to", "url": "https://dev.to", "icon": None},
        "author": article.get("user", {}).get("name", "Dev.to"),
        "publishedAt": article.get("published_at", datetime.now(timezone.utc).isoformat()),
        "imageUrl": article.get("cover_image"),
        "url": article.get("url", "#"),
        "category": category,
        "tags": article.get("tag_list", [])[:5] or ["dev"],
        "engagement": {
            "views": 0,
            "likes": article.get("positive_reactions_count", 0),
            "shares": 0,
            "comments": article.get("comments_count", 0),
        },
    }


class NewsService:
    def __init__(self):
        self._gnews_cache = {}  # cache_key -> (timestamp, articles)
        self._devto_cache = {}  # cache_key -> (timestamp, articles)

    async def fetch_gnews(self, query: str, limit: int = 10) -> List[dict[str, Any]]:
        cache_key = f"{query}_{limit}"
        now = datetime.now(timezone.utc)
        if cache_key in self._gnews_cache:
            ts, cached_arts = self._gnews_cache[cache_key]
            if (now - ts).total_seconds() < 900:  # 15 min cache
                logger.info(f"Returning cached GNews articles for query: {query}")
                return cached_arts

        if not settings.GNEWS_API_KEY:
            logger.warning("GNEWS_API_KEY not set. Returning empty list.")
            return []

        url = "https://gnews.io/api/v4/search"
        params = {"q": query, "lang": "en", "max": limit, "apikey": settings.GNEWS_API_KEY}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    logger.warning(f"GNews API returned {resp.status_code} for query '{query}': {resp.text[:200]}")
                    if cache_key in self._gnews_cache:
                        return self._gnews_cache[cache_key][1]
                    return []
                data = resp.json()
                articles = [_normalize_gnews(a, query) for a in data.get("articles", [])]
                self._gnews_cache[cache_key] = (now, articles)
                return articles
        except Exception as e:
            logger.warning(f"Failed to fetch GNews: {e}")
            if cache_key in self._gnews_cache:
                return self._gnews_cache[cache_key][1]
            return []

    async def fetch_devto(self, tag: Optional[str] = None, page: int = 1, limit: int = 20) -> List[dict[str, Any]]:
        cache_key = f"{tag}_{page}_{limit}"
        now = datetime.now(timezone.utc)
        if cache_key in self._devto_cache:
            ts, cached_arts = self._devto_cache[cache_key]
            if (now - ts).total_seconds() < 900:  # 15 min cache
                logger.info(f"Returning cached Dev.to articles for tag: {tag}")
                return cached_arts

        url = "https://dev.to/api/articles"
        params: dict[str, Any] = {"per_page": limit, "page": page}
        if tag:
            params["tag"] = tag
        headers = {}
        if settings.DEVTO_API_KEY:
            headers["api-key"] = settings.DEVTO_API_KEY

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params, headers=headers)
                if resp.status_code != 200:
                    logger.warning(f"Dev.to API returned {resp.status_code}: {resp.text[:200]}")
                    if cache_key in self._devto_cache:
                        return self._devto_cache[cache_key][1]
                    return []
                articles = [_normalize_devto(a, tag or "programming") for a in resp.json()]
                self._devto_cache[cache_key] = (now, articles)
                return articles
        except Exception as e:
            logger.warning(f"Failed to fetch Dev.to: {e}")
            if cache_key in self._devto_cache:
                return self._devto_cache[cache_key][1]
            return []

    def _extract_topics(self, text: str) -> list[str]:
        candidates = set(re.findall(r"#([A-Za-z0-9_+-]+)", text))
        keywords = re.findall(
            r"\b(?:AI Agents|GPT-5|LangChain|OpenAI|NVIDIA|Apple WWDC|React|Next\.js|Rust|Python|Machine Learning|Startup Funding|Series A|Web3|Cloud|Cybersecurity|Developer Tools|Funding|Startups|AI|Fintech|SaaS)\b",
            text,
            flags=re.IGNORECASE,
        )
        candidates.update(keyword.strip() for keyword in keywords)
        return [candidate.strip() for candidate in candidates if candidate.strip()]

    def _topic_category(self, name: str) -> str:
        cleaned = name.lower()
        if any(keyword in cleaned for keyword in ["ai", "gpt", "langchain", "openai"]):
            return "ai"
        if any(keyword in cleaned for keyword in ["funding", "series a", "venture", "startup"]):
            return "funding"
        if any(keyword in cleaned for keyword in ["react", "next.js", "rust", "python", "web3", "cloud", "cybersecurity"]):
            return "web-development"
        return "startups"

    async def fetch_trending_topics(self, limit: int = 10) -> List[dict[str, Any]]:
        articles: list[dict[str, Any]] = []
        gnews_arts = await self.fetch_gnews("technology startup", limit)
        articles.extend(gnews_arts)

        devto_arts = await self.fetch_devto(None, 1, limit)
        articles.extend(devto_arts)

        topic_counts: Counter[str] = Counter()
        for article in articles:
            text = " ".join([str(article.get(key, "")) for key in ["title", "description", "content"]])
            for topic in self._extract_topics(text):
                topic_counts[topic] += 1

        try:
            from app.database import AsyncSessionLocal
            from app.models.post import Post
            from app.models.community import CommunityDiscussion
            from sqlalchemy import select
            
            async with AsyncSessionLocal() as session:
                posts_result = await session.execute(select(Post.content).order_by(Post.created_at.desc()).limit(20))
                disc_result = await session.execute(
                    select(CommunityDiscussion.title, CommunityDiscussion.content)
                    .order_by(CommunityDiscussion.created_at.desc())
                    .limit(20)
                )
                
                for content in posts_result.scalars().all():
                    if content:
                        for topic in self._extract_topics(content):
                            topic_counts[topic] += 2
                            
                for title, content in disc_result.all():
                    combined = f"{title} {content}"
                    for topic in self._extract_topics(combined):
                        topic_counts[topic] += 2
        except Exception as e:
            logger.warning(f"Could not fetch community activity for trends: {e}")

        if not topic_counts:
            default_topics = ["AI", "Startups", "Funding", "Cloud", "Cybersecurity", "OpenAI"]
            for t in default_topics:
                topic_counts[t] = 3

        results: list[dict[str, Any]] = []
        for topic, count in topic_counts.most_common(limit):
            formatted_topic = topic if topic.startswith("#") else f"#{topic}"
            results.append(
                {
                    "id": re.sub(r"[^a-z0-9]+", "-", topic.lower()).strip("-"),
                    "name": formatted_topic,
                    "category": self._topic_category(topic),
                    "mentions": count * 120,
                    "change": min(99, count * 15),
                    "isHot": count >= 2,
                }
            )
        return results


news_service = NewsService()
