"""User referral fields: referred_by_id and referral_count

Revision ID: 006_user_referral_fields
Revises: 005_verification_document_storage
Create Date: 2026-06-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '006_user_referral_fields'
down_revision = '005_verification_document_storage'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('referred_by_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('referral_count', sa.Integer(), nullable=False, server_default='0'),
    )
    op.create_foreign_key(
        'fk_users_referred_by_id',
        'users',
        'users',
        ['referred_by_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_users_referred_by_id', 'users', ['referred_by_id'])


def downgrade() -> None:
    op.drop_index('ix_users_referred_by_id', table_name='users')
    op.drop_constraint('fk_users_referred_by_id', 'users', type_='foreignkey')
    op.drop_column('users', 'referral_count')
    op.drop_column('users', 'referred_by_id')
