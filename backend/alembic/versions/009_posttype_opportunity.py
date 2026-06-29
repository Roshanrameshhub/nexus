"""Add opportunity value to PostgreSQL posttype enum

Revision ID: 009_posttype_opportunity
Revises: 008_opportunity_posts
Create Date: 2026-06-14

Production fix: application code uses post_type='opportunity' but the
PostgreSQL posttype enum was created without that value via SQLAlchemy
create_all before opportunity was added to the Python PostType enum.
"""
from alembic import op

revision = "009_posttype_opportunity"
down_revision = "008_opportunity_posts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Safe on existing production DBs: no table drops, idempotent add.
    op.execute(
        """
        DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'posttype') THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_type t
                    JOIN pg_enum e ON t.oid = e.enumtypid
                    WHERE t.typname = 'posttype' AND e.enumlabel = 'opportunity'
                ) THEN
                    ALTER TYPE posttype ADD VALUE 'opportunity';
                END IF;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # PostgreSQL cannot remove enum values without recreating the type.
    pass
