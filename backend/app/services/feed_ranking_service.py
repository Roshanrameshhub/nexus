"""Recommendation-based ranking for the main feed."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.connection import Connection, ConnectionStatus
from app.models.post import Post, PostType
from app.models.user import User
from app.services.recommendation_service import NetworkGraph, recommendation_service

FeedScope = Literal["all", "connections", "my_posts"]

MAX_CANDIDATES = 800


def _stable_key(post_id: UUID) -> int:
    return int(hashlib.md5(str(post_id).encode()).hexdigest()[:8], 16)


def _recency_bonus(created_at: datetime) -> int:
    now = datetime.now(timezone.utc)
    created = created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)
    age_hours = max(0.0, (now - created).total_seconds() / 3600)
    if age_hours <= 24:
        return 25
    if age_hours <= 168:
        return max(5, 25 - int(age_hours / 24) * 3)
    return 2


def _engagement_bonus(post: Post) -> int:
    engagement = (post.likes_count or 0) + (post.comments_count or 0) * 2 + (post.reactions_count or 0)
    return min(engagement, 50)


async def build_network_graph(db: AsyncSession, current_user: User) -> NetworkGraph:
    accepted_result = await db.execute(
        select(Connection.sender_id, Connection.receiver_id).where(
            Connection.status == ConnectionStatus.accepted
        )
    )
    accepted_pairs = list(accepted_result.all())

    pending_result = await db.execute(
        select(Connection.sender_id, Connection.receiver_id).where(
            Connection.status == ConnectionStatus.pending,
            or_(
                Connection.sender_id == current_user.id,
                Connection.receiver_id == current_user.id,
            ),
        )
    )
    pending_pairs = list(pending_result.all())

    referral_peer_ids: set = set()
    if current_user.referred_by_id:
        sibling_result = await db.execute(
            select(User.id).where(
                User.referred_by_id == current_user.referred_by_id,
                User.id != current_user.id,
                User.is_suspended.is_(False),
                User.is_banned.is_(False),
            )
        )
        referral_peer_ids.update(sibling_result.scalars().all())
    referred_result = await db.execute(
        select(User.id).where(
            User.referred_by_id == current_user.id,
            User.is_suspended.is_(False),
            User.is_banned.is_(False),
        )
    )
    referral_peer_ids.update(referred_result.scalars().all())

    return NetworkGraph.build(
        current_user.id,
        accepted_pairs,
        pending_pairs,
        referral_peer_ids,
    )


def score_feed_post(
    current_user: User | None,
    post: Post,
    graph: NetworkGraph | None,
) -> int:
    """Higher score = shown earlier in feed."""
    score = _engagement_bonus(post) + _recency_bonus(post.created_at)

    if not current_user or not post.author:
        return score + (_stable_key(post.id) % 50)

    author = post.author
    if graph and author.id in graph.connected_ids:
        score += 100

    if graph:
        rel_score, _, _ = recommendation_service.score_relationship_recommendation(
            current_user, author, graph
        )
        score += rel_score

    return score


def rank_posts(
    posts: list[Post],
    current_user: User | None,
    graph: NetworkGraph | None,
    *,
    scope: FeedScope,
) -> list[Post]:
    if scope == "my_posts":
        return sorted(posts, key=lambda p: p.created_at, reverse=True)

    scored: list[tuple[int, int, Post]] = []
    for post in posts:
        raw = score_feed_post(current_user, post, graph)
        scored.append((raw, _stable_key(post.id), post))

    scored.sort(key=lambda item: (-item[0], item[1]))
    return [item[2] for item in scored]


async def fetch_ranked_feed_posts(
    db: AsyncSession,
    current_user: User | None,
    *,
    scope: FeedScope = "all",
    post_type: str | None = None,
) -> list[Post]:
    query = select(Post).options(selectinload(Post.author))

    if post_type:
        try:
            query = query.where(Post.post_type == PostType(post_type))
        except ValueError:
            pass

    if scope == "my_posts":
        if not current_user:
            return []
        query = query.where(Post.user_id == current_user.id)
    elif scope == "connections":
        if not current_user:
            return []
        query = (
            query.join(User, Post.user_id == User.id)
            .join(
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
        )

    result = await db.execute(query.order_by(Post.created_at.desc()).limit(MAX_CANDIDATES))
    posts = list(result.scalars().unique().all())

    graph = await build_network_graph(db, current_user) if current_user else None
    return rank_posts(posts, current_user, graph, scope=scope)
