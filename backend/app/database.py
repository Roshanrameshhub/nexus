from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config.settings import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def _apply_schema_patches(conn) -> None:
    """Add columns/tables for existing DBs (create_all does not alter existing tables)."""
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(50) NOT NULL DEFAULT 'text'")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags TEXT[] NOT NULL DEFAULT '{}'::text[]")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS mentions TEXT[] NOT NULL DEFAULT '{}'::text[]")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS reactions_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID")
    )
    await conn.execute(
        text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS reactions_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE comments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_comments_parent_comment_id ON comments (parent_comment_id)")
    )
    await conn.execute(
        text(
            "DO $$ BEGIN \n"
            "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comments_parent_comment_id') THEN \n"
            "    ALTER TABLE comments ADD CONSTRAINT fk_comments_parent_comment_id FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE; \n"
            "END IF; \n"
            "END $$;"
        )
    )
    await conn.execute(
        text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments TEXT[] NOT NULL DEFAULT '{}'::text[]")
    )
    await conn.execute(
        text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'text'")
    )
    await conn.execute(
        text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachment_meta JSONB")
    )
    
    # Add new onboarding user columns
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS college VARCHAR(255)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_details JSONB DEFAULT '{}'::jsonb")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_user_id VARCHAR(50)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS github_avatar_url VARCHAR(500)")
    )

    # Alter UserRole enum type to include new values
    try:
        # Check if type exists first to avoid errors
        await conn.execute(
            text(
                "DO $$ BEGIN "
                "IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN "
                "  ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'executive';"
                "  ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'investor';"
                "END IF; "
                "END $$;"
            )
        )
    except Exception:
        pass

    # Create meetings table
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS meetings (
                id UUID PRIMARY KEY,
                organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                scheduled_at TIMESTAMPTZ NOT NULL,
                meeting_type VARCHAR(50) NOT NULL,
                meet_link VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    await conn.execute(
        text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending'")
    )
    await conn.execute(
        text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60")
    )
    await conn.execute(
        text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_provider VARCHAR(50) NOT NULL DEFAULT 'google_meet'")
    )
    await conn.execute(
        text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255)")
    )
    await conn.execute(
        text("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS notes TEXT")
    )

    # Create news_likes and news_comments tables
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS news_likes (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                article_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_news_like UNIQUE (user_id, article_id)
            )
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS news_comments (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                article_id VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )

    # Add missing columns to startup_positions table
    await conn.execute(
        text("ALTER TABLE startup_positions ADD COLUMN IF NOT EXISTS skills_required VARCHAR[] NOT NULL DEFAULT '{}'::VARCHAR[]")
    )
    await conn.execute(
        text("ALTER TABLE startup_positions ADD COLUMN IF NOT EXISTS experience_required VARCHAR(100)")
    )
    await conn.execute(
        text("ALTER TABLE startup_positions ADD COLUMN IF NOT EXISTS compensation VARCHAR(120)")
    )
    await conn.execute(
        text("ALTER TABLE startup_positions ADD COLUMN IF NOT EXISTS equity VARCHAR(60)")
    )
    await conn.execute(
        text("ALTER TABLE startup_positions ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)")
    )

    await conn.execute(
        text("ALTER TABLE communities ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[]")
    )
    await conn.execute(
        text("ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS shares_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE community_discussions ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS discussion_likes (
                id UUID PRIMARY KEY,
                discussion_id UUID NOT NULL REFERENCES community_discussions(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_discussion_like UNIQUE (discussion_id, user_id)
            )
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS discussion_comments (
                id UUID PRIMARY KEY,
                discussion_id UUID NOT NULL REFERENCES community_discussions(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                parent_comment_id UUID REFERENCES discussion_comments(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_discussion_comments_parent ON discussion_comments (parent_comment_id)")
    )

    # Super admin platform columns
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role VARCHAR(20) NOT NULL DEFAULT 'USER'")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak_current INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak_longest INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32)")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS pin_order INTEGER")
    )
    await conn.execute(
        text("ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS document_content BYTEA")
    )
    await conn.execute(
        text("ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS document_mime VARCHAR(100)")
    )



async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_schema_patches(conn)
