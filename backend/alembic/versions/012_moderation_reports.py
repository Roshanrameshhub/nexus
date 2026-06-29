"""Extend moderation and reporting system

Revision ID: 012_moderation_reports
Revises: 011_poll_system
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "012_moderation_reports"
down_revision = "011_poll_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_banned", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "content_reports",
        sa.Column("reported_user_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "content_reports",
        sa.Column("is_high_priority", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_foreign_key(
        "fk_content_reports_reported_user_id",
        "content_reports",
        "users",
        ["reported_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_content_reports_reported_user_id", "content_reports", ["reported_user_id"])
    op.create_index("ix_content_reports_target_type", "content_reports", ["target_type"])
    op.create_index("ix_content_reports_target_id", "content_reports", ["target_id"])
    op.execute("UPDATE content_reports SET status = 'pending' WHERE status = 'open'")


def downgrade() -> None:
    op.execute("UPDATE content_reports SET status = 'open' WHERE status = 'pending'")
    op.drop_index("ix_content_reports_target_id", table_name="content_reports")
    op.drop_index("ix_content_reports_target_type", table_name="content_reports")
    op.drop_index("ix_content_reports_reported_user_id", table_name="content_reports")
    op.drop_constraint("fk_content_reports_reported_user_id", "content_reports", type_="foreignkey")
    op.drop_column("content_reports", "is_high_priority")
    op.drop_column("content_reports", "reported_user_id")
    op.drop_column("users", "is_banned")
