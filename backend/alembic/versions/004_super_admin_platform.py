"""Super admin platform: platform_role, admin console tables, pinned posts

Revision ID: 004_super_admin_platform
Revises: 003_phase19_advanced_features
Create Date: 2026-06-07

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004_super_admin_platform'
down_revision = '003_phase19_advanced_features'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('platform_role', sa.String(20), nullable=False, server_default='USER'))
    op.add_column('users', sa.Column('is_suspended', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('last_active_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('login_streak_current', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('login_streak_longest', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('referral_code', sa.String(32), nullable=True))
    op.create_index('ix_users_platform_role', 'users', ['platform_role'])
    op.create_index('ix_users_referral_code', 'users', ['referral_code'], unique=True)

    op.add_column('posts', sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('posts', sa.Column('pin_order', sa.Integer(), nullable=True))

    op.create_table(
        'admin_announcements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('audience', sa.String(50), nullable=False, server_default='all'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'verification_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False),
        sa.Column('document_url', sa.String(500), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('reviewed_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('review_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_verification_requests_user_id', 'verification_requests', ['user_id'])
    op.create_index('ix_verification_requests_status', 'verification_requests', ['status'])

    op.create_table(
        'referrals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referrer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referred_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['referred_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('referred_id'),
    )
    op.create_index('ix_referrals_referrer_id', 'referrals', ['referrer_id'])

    op.create_table(
        'content_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reporter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(100), nullable=False),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='open'),
        sa.Column('resolved_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_content_reports_status', 'content_reports', ['status'])

    op.create_table(
        'admin_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(120), nullable=False),
        sa.Column('target_type', sa.String(50), nullable=True),
        sa.Column('target_id', sa.String(100), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_admin_audit_logs_actor_id', 'admin_audit_logs', ['actor_id'])
    op.create_index('ix_admin_audit_logs_created_at', 'admin_audit_logs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_admin_audit_logs_created_at', table_name='admin_audit_logs')
    op.drop_index('ix_admin_audit_logs_actor_id', table_name='admin_audit_logs')
    op.drop_table('admin_audit_logs')
    op.drop_index('ix_content_reports_status', table_name='content_reports')
    op.drop_table('content_reports')
    op.drop_index('ix_referrals_referrer_id', table_name='referrals')
    op.drop_table('referrals')
    op.drop_index('ix_verification_requests_status', table_name='verification_requests')
    op.drop_index('ix_verification_requests_user_id', table_name='verification_requests')
    op.drop_table('verification_requests')
    op.drop_table('admin_announcements')
    op.drop_column('posts', 'pin_order')
    op.drop_column('posts', 'is_pinned')
    op.drop_index('ix_users_referral_code', table_name='users')
    op.drop_index('ix_users_platform_role', table_name='users')
    op.drop_column('users', 'referral_code')
    op.drop_column('users', 'login_streak_longest')
    op.drop_column('users', 'login_streak_current')
    op.drop_column('users', 'last_active_at')
    op.drop_column('users', 'is_verified')
    op.drop_column('users', 'is_suspended')
    op.drop_column('users', 'platform_role')
