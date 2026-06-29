"""Add city and state to users

Revision ID: 010_user_location_fields
Revises: 009_posttype_opportunity
"""
from alembic import op
import sqlalchemy as sa

revision = "010_user_location_fields"
down_revision = "009_posttype_opportunity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("city", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("state", sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "state")
    op.drop_column("users", "city")
