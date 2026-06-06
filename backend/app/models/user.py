import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text, JSON
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


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
    google_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    password_reset_token: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    password_reset_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # New onboarding profile fields
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    college: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role_details: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)

    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
