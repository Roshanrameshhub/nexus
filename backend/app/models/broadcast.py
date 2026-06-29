import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AdminBroadcast(Base):
    __tablename__ = "admin_broadcasts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    broadcast_type: Mapped[str] = mapped_column(String(30), index=True)  # announcement | admin_post | notification
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    audience: Mapped[str] = mapped_column(String(50), default="all")
    custom_audience: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    show_in_dashboard: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    show_in_notification_center: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    send_in_app_notification: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    send_browser_push: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    send_mobile_push: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    announcement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admin_announcements.id", ondelete="SET NULL"), nullable=True, index=True
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    view_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    click_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    notification_open_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    push_delivery_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    created_by = relationship("User", foreign_keys=[created_by_id])
    announcement = relationship("AdminAnnouncement", foreign_keys=[announcement_id])
    post = relationship("Post", foreign_keys=[post_id])
