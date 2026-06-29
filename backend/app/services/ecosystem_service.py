"""Ecosystem feed filtering and opportunity trending helpers."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.sql import Select

from app.models.post import Post, PostType
from app.models.user import User, UserRole

ECOSYSTEM_CREATOR_ROLES = {
    UserRole.founder,
    UserRole.executive,
    UserRole.investor,
    UserRole.developer,
}

OPPORTUNITY_CREATOR_ROLES = {
    UserRole.founder,
    UserRole.executive,
    UserRole.investor,
    UserRole.developer,
}

ECOSYSTEM_POST_TYPES = {
    PostType.startup_update,
    PostType.funding,
    PostType.product_launch,
    PostType.opportunity,
    PostType.hiring,
    PostType.event,
    PostType.text,
}

OPPORTUNITY_SUBTYPES = {
    "job_opening",
    "internship",
    "co_founder_search",
    "investment_opportunity",
    "partnership_opportunity",
    "beta_tester_recruitment",
    "event_invitation",
    "project_showcase",
    "portfolio_showcase",
    "open_source_launch",
    "freelance_availability",
    "technical_achievement",
    "looking_for_opportunity",
}

DEVELOPER_SHOWCASE_TYPES = {
    "project_showcase",
    "portfolio_showcase",
    "open_source_launch",
    "freelance_availability",
    "technical_achievement",
    "looking_for_opportunity",
}

HIRING_SUBTYPES = {"job_opening", "internship", "co_founder_search", "beta_tester_recruitment"}


def can_create_ecosystem_post(role: str | UserRole, post_type: str) -> bool:
    role_val = role.value if hasattr(role, "value") else str(role)
    if post_type == PostType.opportunity.value or post_type == "opportunity":
        return role_val in {r.value for r in OPPORTUNITY_CREATOR_ROLES}
    if post_type in {t.value for t in ECOSYSTEM_POST_TYPES}:
        return role_val in {r.value for r in ECOSYSTEM_CREATOR_ROLES}
    return True


def ecosystem_posts_where():
    """SQLAlchemy filter clauses for ecosystem feed (requires User join)."""
    return and_(
        or_(
            User.role == UserRole.founder,
            User.role == UserRole.executive,
            User.role == UserRole.investor,
            User.role == UserRole.developer,
        ),
        or_(
            Post.post_type.in_(
                [
                    PostType.startup_update,
                    PostType.funding,
                    PostType.product_launch,
                    PostType.opportunity,
                    PostType.hiring,
                    PostType.event,
                ]
            ),
            Post.post_type == PostType.text,
        ),
    )


def apply_ecosystem_base_filter(query: Select) -> Select:
    """Posts from ecosystem creators with ecosystem-relevant types."""
    return query.join(User, Post.user_id == User.id).where(ecosystem_posts_where())


def apply_ecosystem_category_filter(query: Select, category: Optional[str]) -> Select:
    if not category or category.lower() == "all":
        return query

    cat = category.lower()
    if cat == "startup_milestones":
        return query.where(Post.post_type == PostType.startup_update)
    if cat == "product_launches":
        return query.where(Post.post_type == PostType.product_launch)
    if cat == "updates":
        return query.where(
            Post.post_type.in_(
                [PostType.startup_update, PostType.product_launch, PostType.text]
            )
        )
    if cat == "opportunities":
        return query.where(
            and_(
                Post.post_type == PostType.opportunity,
                or_(
                    Post.opportunity_details["opportunity_type"].astext.is_(None),
                    Post.opportunity_details["opportunity_type"].astext.notin_(
                        list(HIRING_SUBTYPES)
                        + ["investment_opportunity", "partnership_opportunity", "event_invitation"]
                        + list(DEVELOPER_SHOWCASE_TYPES)
                    ),
                ),
            )
        )
    if cat == "partnerships":
        return query.where(
            or_(
                and_(
                    Post.post_type == PostType.opportunity,
                    Post.opportunity_details["opportunity_type"].astext == "partnership_opportunity",
                ),
            )
        )
    if cat == "developer_showcases":
        return query.where(
            or_(
                User.role == UserRole.developer,
                and_(
                    Post.post_type == PostType.opportunity,
                    Post.opportunity_details["opportunity_type"].astext.in_(list(DEVELOPER_SHOWCASE_TYPES)),
                ),
            )
        )
    if cat == "industry_insights":
        return query.where(
            and_(
                User.role == UserRole.executive,
                Post.post_type == PostType.text,
            )
        )
    if cat == "funding":
        return query.where(
            or_(
                Post.post_type == PostType.funding,
                and_(
                    Post.post_type == PostType.opportunity,
                    Post.opportunity_details["opportunity_type"].astext == "investment_opportunity",
                ),
            )
        )
    if cat == "hiring":
        return query.where(
            or_(
                Post.post_type == PostType.hiring,
                and_(
                    Post.post_type == PostType.opportunity,
                    Post.opportunity_details["opportunity_type"].astext.in_(list(HIRING_SUBTYPES)),
                ),
            )
        )
    if cat == "events":
        return query.where(
            or_(
                Post.post_type == PostType.event,
                and_(
                    Post.post_type == PostType.opportunity,
                    Post.opportunity_details["opportunity_type"].astext == "event_invitation",
                ),
            )
        )
    if cat == "investments":
        return query.where(
            or_(
                Post.post_type == PostType.funding,
                and_(
                    Post.post_type == PostType.opportunity,
                    Post.opportunity_details["opportunity_type"].astext == "investment_opportunity",
                ),
            )
        )
    return query


def opportunity_is_active(post: Post) -> bool:
    if post.post_type != PostType.opportunity:
        return False
    details = post.opportunity_details or {}
    expiry = details.get("expiry_date")
    if not expiry:
        return True
    try:
        if isinstance(expiry, str):
            exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            return exp_dt >= datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return True
    return True


def score_opportunity_for_skills(post: Post, user_skills: list[str]) -> int:
    if not user_skills:
        return post.likes_count or 0
    details = post.opportunity_details or {}
    haystack = " ".join(
        [
            post.content or "",
            details.get("title") or "",
            details.get("organization") or "",
            details.get("opportunity_type") or "",
            details.get("location") or "",
            " ".join(post.hashtags or []),
        ]
    ).lower()
    score = 0
    for skill in user_skills:
        s = skill.strip().lower()
        if s and s in haystack:
            score += 10
    score += min(post.likes_count or 0, 20)
    score += min(post.comments_count or 0, 10)
    return score
