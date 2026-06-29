"""Content promotion and advanced announcements

Revision ID: 007_content_promotion
Revises: 006_user_referral_fields
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "007_content_promotion"
down_revision = "006_user_referral_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("pinned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("posts", sa.Column("pinned_by_id", sa.UUID(), nullable=True))
    op.add_column("posts", sa.Column("pin_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_posts_pinned_by_id",
        "posts",
        "users",
        ["pinned_by_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column(
        "admin_announcements",
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
    )
    op.add_column("admin_announcements", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("admin_announcements", sa.Column("publish_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("admin_announcements", sa.Column("cta_label", sa.String(100), nullable=True))
    op.add_column("admin_announcements", sa.Column("cta_url", sa.String(500), nullable=True))
    op.add_column(
        "admin_announcements",
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "admin_announcements",
        sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "admin_announcements",
        sa.Column("dismiss_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("admin_announcements", sa.Column("custom_audience", sa.Text(), nullable=True))

    op.create_table(
        "announcement_dismissals",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "announcement_id",
            sa.UUID(),
            sa.ForeignKey("admin_announcements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "announcement_id", name="uq_announcement_dismissal"),
    )
    op.create_index("ix_announcement_dismissals_user_id", "announcement_dismissals", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_announcement_dismissals_user_id", table_name="announcement_dismissals")
    op.drop_table("announcement_dismissals")
    op.drop_column("admin_announcements", "custom_audience")
    op.drop_column("admin_announcements", "dismiss_count")
    op.drop_column("admin_announcements", "click_count")
    op.drop_column("admin_announcements", "view_count")
    op.drop_column("admin_announcements", "cta_url")
    op.drop_column("admin_announcements", "cta_label")
    op.drop_column("admin_announcements", "publish_at")
    op.drop_column("admin_announcements", "expires_at")
    op.drop_column("admin_announcements", "priority")
    op.drop_constraint("fk_posts_pinned_by_id", "posts", type_="foreignkey")
    op.drop_column("posts", "pin_expires_at")
    op.drop_column("posts", "pinned_by_id")
    op.drop_column("posts", "pinned_at")
