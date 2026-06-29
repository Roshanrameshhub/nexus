"""Add poll_details and poll_votes

Revision ID: 011_poll_system
Revises: 010_user_location_fields
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "011_poll_system"
down_revision = "010_user_location_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("poll_details", sa.JSON(), nullable=True))
    op.create_table(
        "poll_votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_id", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("post_id", "user_id", name="uq_poll_vote_per_user"),
    )
    op.create_index("ix_poll_votes_post_id", "poll_votes", ["post_id"])
    op.create_index("ix_poll_votes_user_id", "poll_votes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_poll_votes_user_id", table_name="poll_votes")
    op.drop_index("ix_poll_votes_post_id", table_name="poll_votes")
    op.drop_table("poll_votes")
    op.drop_column("posts", "poll_details")
