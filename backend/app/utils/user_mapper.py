from app.models.user import User
from app.schemas.user import UserPublic, UserResponse


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        bio=user.bio,
        skills=user.skills or [],
        avatar=user.profile_image,
        role=user.role.value if hasattr(user.role, "value") else user.role,
        platform_role=getattr(user, "platform_role", None) or "USER",
        is_verified=bool(getattr(user, "is_verified", False)),
        last_active_at=getattr(user, "last_active_at", None),
        github_username=user.github_username,
        country=user.country,
        college=user.college,
        company=user.company,
        role_details=user.role_details,
    )


def to_user_public(user: User, include_email: bool = False) -> UserPublic:
    return UserPublic(
        id=user.id,
        name=user.name,
        email=user.email if include_email else None,
        bio=user.bio,
        skills=user.skills or [],
        avatar=user.profile_image,
        role=user.role.value if hasattr(user.role, "value") else user.role,
        is_verified=bool(getattr(user, "is_verified", False)),
        github_username=user.github_username,
        created_at=user.created_at,
        country=user.country,
        college=user.college,
        company=user.company,
        role_details=user.role_details,
    )
