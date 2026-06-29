"""Phase 19: Advanced engagement & messaging experience

Revision ID: 003_phase19_advanced_features
Revises: 002_workspace_connections
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003_phase19_advanced_features'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to posts table
    op.add_column('posts', sa.Column('post_type', sa.String(50), nullable=False, server_default='text'))
    op.add_column('posts', sa.Column('hashtags', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'))
    op.add_column('posts', sa.Column('mentions', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'))
    op.add_column('posts', sa.Column('reactions_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('posts', sa.Column('shares_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('posts', sa.Column('views_count', sa.Integer(), nullable=False, server_default='0'))

    # Add new columns to comments table
    op.add_column('comments', sa.Column('parent_comment_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('comments', sa.Column('reactions_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('comments', sa.Column('created_at', sa.DateTime(timezone=True), nullable=True))
    
    op.create_foreign_key('fk_comments_parent_comment_id', 'comments', 'comments', ['parent_comment_id'], ['id'], ondelete='CASCADE')
    op.create_index('ix_comments_parent_comment_id', 'comments', ['parent_comment_id'])

    # Add new columns to messages table
    op.add_column('messages', sa.Column('attachments', postgresql.ARRAY(sa.String()), nullable=False, server_default='{}'))
    op.add_column('messages', sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('messages', sa.Column('is_edited', sa.Boolean(), nullable=False, server_default='false'))

    # Create post_reactions table
    op.create_table(
        'post_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reaction_type', sa.String(20), nullable=False, server_default='like'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_post_reactions_post_id', 'post_reactions', ['post_id'])
    op.create_index('ix_post_reactions_user_id', 'post_reactions', ['user_id'])

    # Create comment_reactions table
    op.create_table(
        'comment_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('comment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reaction_type', sa.String(20), nullable=False, server_default='like'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_comment_reactions_comment_id', 'comment_reactions', ['comment_id'])
    op.create_index('ix_comment_reactions_user_id', 'comment_reactions', ['user_id'])

    # Create message_reactions table
    op.create_table(
        'message_reactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('message_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reaction_type', sa.String(20), nullable=False, server_default='like'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_message_reactions_message_id', 'message_reactions', ['message_id'])
    op.create_index('ix_message_reactions_user_id', 'message_reactions', ['user_id'])

    # Create reposts table
    op.create_table(
        'reposts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('original_post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['original_post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_reposts_original_post_id', 'reposts', ['original_post_id'])
    op.create_index('ix_reposts_user_id', 'reposts', ['user_id'])
    op.create_index('ix_reposts_created_at', 'reposts', ['created_at'])

    # Create bookmarks table
    op.create_table(
        'bookmarks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['post_id'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_bookmarks_post_id', 'bookmarks', ['post_id'])
    op.create_index('ix_bookmarks_user_id', 'bookmarks', ['user_id'])
    op.create_index('ix_bookmarks_created_at', 'bookmarks', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_bookmarks_created_at', table_name='bookmarks')
    op.drop_index('ix_bookmarks_user_id', table_name='bookmarks')
    op.drop_index('ix_bookmarks_post_id', table_name='bookmarks')
    op.drop_index('ix_reposts_created_at', table_name='reposts')
    op.drop_index('ix_reposts_user_id', table_name='reposts')
    op.drop_index('ix_reposts_original_post_id', table_name='reposts')
    op.drop_index('ix_message_reactions_user_id', table_name='message_reactions')
    op.drop_index('ix_message_reactions_message_id', table_name='message_reactions')
    op.drop_index('ix_comment_reactions_user_id', table_name='comment_reactions')
    op.drop_index('ix_comment_reactions_comment_id', table_name='comment_reactions')
    op.drop_index('ix_post_reactions_user_id', table_name='post_reactions')
    op.drop_index('ix_post_reactions_post_id', table_name='post_reactions')

    # Drop tables
    op.drop_table('bookmarks')
    op.drop_table('reposts')
    op.drop_table('message_reactions')
    op.drop_table('comment_reactions')
    op.drop_table('post_reactions')

    # Drop foreign keys and columns from messages
    op.drop_column('messages', 'is_edited')
    op.drop_column('messages', 'is_read')
    op.drop_column('messages', 'attachments')

    # Drop foreign keys and columns from comments
    op.drop_index('ix_comments_parent_comment_id', table_name='comments')
    op.drop_constraint('fk_comments_parent_comment_id', 'comments', type_='foreignkey')
    op.drop_column('comments', 'created_at')
    op.drop_column('comments', 'reactions_count')
    op.drop_column('comments', 'parent_comment_id')

    # Drop columns from posts
    op.drop_column('posts', 'views_count')
    op.drop_column('posts', 'shares_count')
    op.drop_column('posts', 'reactions_count')
    op.drop_column('posts', 'mentions')
    op.drop_column('posts', 'hashtags')
    op.drop_column('posts', 'post_type')
