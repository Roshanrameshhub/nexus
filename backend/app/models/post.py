import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, JSON, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PostType(str, enum.Enum):
    text = "text"
    image = "image"
    poll = "poll"
    event = "event"
    startup_update = "startup_update"
    hiring = "hiring"
    funding = "funding"
    product_launch = "product_launch"
    product_update = "product_update"
    platform_update = "platform_update"
    opportunity = "opportunity"


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    post_type: Mapped[PostType] = mapped_column(Enum(PostType), default=PostType.text)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    hashtags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    mentions: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    likes_count: Mapped[int] = mapped_column(Integer, default=0)
    reactions_count: Mapped[int] = mapped_column(Integer, default=0)
    comments_count: Mapped[int] = mapped_column(Integer, default=0)
    shares_count: Mapped[int] = mapped_column(Integer, default=0)
    views_count: Mapped[int] = mapped_column(Integer, default=0)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    pin_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pinned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pinned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    pin_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opportunity_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    poll_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_official: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    official_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    show_in_announcements_hub: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    broadcast_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_broadcasts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    author = relationship("User", back_populates="posts", foreign_keys=[user_id])
    pinned_by = relationship("User", foreign_keys=[pinned_by_id])
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    reactions = relationship("PostReaction", back_populates="post", cascade="all, delete-orphan")
    reposts = relationship(
        "Repost",
        foreign_keys="Repost.original_post_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class PostLike(Base):
    __tablename__ = "post_likes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    post = relationship("Post", back_populates="likes")


class PollVote(Base):
    __tablename__ = "poll_votes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_poll_vote_per_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    option_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    post = relationship("Post")
