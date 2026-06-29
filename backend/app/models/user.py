import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, Integer, String, Text, JSON
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.platform import PlatformRole


class UserRole(str, enum.Enum):
    founder = "founder"
    developer = "developer"
    mentor = "mentor"
    # recruiter role removed
    student = "student"
    executive = "executive"
    investor = "investor"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    profile_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_user_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    github_username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    github_avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    github_access_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.developer)
    platform_role: Mapped[str] = mapped_column(String(20), default=PlatformRole.USER.value, server_default="USER")
    google_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    email_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    email_verification_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_active_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    login_streak_current: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    login_streak_longest: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    streak_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    referral_code: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    referred_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )
    referral_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Onboarding profile fields
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    state: Mapped[str | None] = mapped_column(String(120), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    college: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role_details: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    posts = relationship(
        "Post",
        back_populates="author",
        foreign_keys="Post.user_id",
        cascade="all, delete-orphan",
    )
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
