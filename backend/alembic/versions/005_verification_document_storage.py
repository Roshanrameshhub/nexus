"""Verification documents stored in database for Render persistence

Revision ID: 005_verification_document_storage
Revises: 004_super_admin_platform
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa

revision = '005_verification_document_storage'
down_revision = '004_super_admin_platform'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('verification_requests', sa.Column('document_content', sa.LargeBinary(), nullable=True))
    op.add_column('verification_requests', sa.Column('document_mime', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('verification_requests', 'document_mime')
    op.drop_column('verification_requests', 'document_content')
