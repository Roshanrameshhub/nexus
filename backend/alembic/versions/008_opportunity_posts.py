"""Revision ID: 008_opportunity_posts"""
from alembic import op
import sqlalchemy as sa

revision = "008_opportunity_posts"
down_revision = "007_content_promotion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("opportunity_details", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "opportunity_details")
