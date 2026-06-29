"""Add mandatory email verification fields to users.

Revision ID: 013_email_verification
Revises: 012_moderation_reports
"""
from alembic import op
import sqlalchemy as sa

revision = "013_email_verification"
down_revision = "012_moderation_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_email_verified", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("email_verification_token", sa.String(255), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("email_verification_expires", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email_verification_token", "users", ["email_verification_token"])
    op.execute(
        "UPDATE users SET is_email_verified = TRUE "
        "WHERE is_email_verified = FALSE AND email_verification_token IS NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_users_email_verification_token", table_name="users")
    op.drop_column("users", "email_verification_expires")
    op.drop_column("users", "email_verification_token")
    op.drop_column("users", "is_email_verified")
