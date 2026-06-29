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
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ")
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_users_email_verification_token "
            "ON users (email_verification_token)"
        )
    )
    await conn.execute(
        text(
            "UPDATE users SET is_email_verified = TRUE "
            "WHERE is_email_verified = FALSE AND email_verification_token IS NULL"
        )
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
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS opportunity_details JSONB")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS poll_details JSONB")
    )
    await conn.execute(
        text(
            "CREATE TABLE IF NOT EXISTS poll_votes ("
            "id UUID PRIMARY KEY, "
            "post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE, "
            "user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, "
            "option_id VARCHAR(64) NOT NULL, "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
            "CONSTRAINT uq_poll_vote_per_user UNIQUE (post_id, user_id)"
            ")"
        )
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_poll_votes_post_id ON poll_votes (post_id)")
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_poll_votes_user_id ON poll_votes (user_id)")
    )
    await conn.execute(
        text("ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
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
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(120)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(120)")
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
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak_current INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS login_streak_longest INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_started_at TIMESTAMPTZ")
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
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_by_id UUID")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS pin_expires_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS cta_label VARCHAR(100)")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS cta_url VARCHAR(500)")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS dismiss_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS custom_audience TEXT")
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS announcement_dismissals (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                announcement_id UUID NOT NULL REFERENCES admin_announcements(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                UNIQUE (user_id, announcement_id)
            )
            """
        )
    )
    await conn.execute(
        text("ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS document_content BYTEA")
    )
    await conn.execute(
        text("ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS document_mime VARCHAR(100)")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id UUID")
    )
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS user_daily_logins (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                activity_date DATE NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_user_daily_login UNIQUE (user_id, activity_date)
            )
            """
        )
    )
    await conn.execute(
        text("CREATE INDEX IF NOT EXISTS ix_user_daily_logins_user_id ON user_daily_logins (user_id)")
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_user_daily_logins_activity_date ON user_daily_logins (activity_date)"
        )
    )
    await conn.execute(
        text("ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL")
    )
    await conn.execute(
        text("ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS is_high_priority BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("UPDATE content_reports SET status = 'pending' WHERE status = 'open'")
    )

    # Broadcast & push notification system
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS admin_broadcasts (
                id UUID PRIMARY KEY,
                broadcast_type VARCHAR(30) NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                audience VARCHAR(50) NOT NULL DEFAULT 'all',
                custom_audience TEXT,
                target_country VARCHAR(100),
                target_city VARCHAR(120),
                show_in_dashboard BOOLEAN NOT NULL DEFAULT TRUE,
                show_in_notification_center BOOLEAN NOT NULL DEFAULT TRUE,
                send_in_app_notification BOOLEAN NOT NULL DEFAULT TRUE,
                send_browser_push BOOLEAN NOT NULL DEFAULT FALSE,
                send_mobile_push BOOLEAN NOT NULL DEFAULT FALSE,
                announcement_id UUID REFERENCES admin_announcements(id) ON DELETE SET NULL,
                post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
                view_count INTEGER NOT NULL DEFAULT 0,
                click_count INTEGER NOT NULL DEFAULT 0,
                notification_open_count INTEGER NOT NULL DEFAULT 0,
                push_delivery_count INTEGER NOT NULL DEFAULT 0,
                created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS push_tokens (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                platform VARCHAR(20) NOT NULL,
                token VARCHAR(512) NOT NULL,
                subscription_json TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_push_token_user_platform_token UNIQUE (user_id, platform, token)
            )
            """
        )
    )
    await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_push_tokens_user_id ON push_tokens (user_id)"))
    await conn.execute(
        text("ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS subscription_version VARCHAR(32)")
    )
    await conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS ix_push_tokens_subscription_version "
            "ON push_tokens (subscription_version)"
        )
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS target_country VARCHAR(100)")
    )
    await conn.execute(text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS target_city VARCHAR(120)"))
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS show_in_dashboard BOOLEAN NOT NULL DEFAULT TRUE")
    )
    await conn.execute(
        text(
            "ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS show_in_notification_center BOOLEAN NOT NULL DEFAULT TRUE"
        )
    )
    await conn.execute(
        text(
            "ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS send_in_app_notification BOOLEAN NOT NULL DEFAULT TRUE"
        )
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS send_browser_push BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS send_mobile_push BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text(
            "ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS notification_open_count INTEGER NOT NULL DEFAULT 0"
        )
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS push_delivery_count INTEGER NOT NULL DEFAULT 0")
    )
    await conn.execute(
        text("ALTER TABLE admin_announcements ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES admin_broadcasts(id) ON DELETE SET NULL")
    )
    await conn.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT FALSE"))
    await conn.execute(text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS official_label VARCHAR(120)"))
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_in_announcements_hub BOOLEAN NOT NULL DEFAULT FALSE")
    )
    await conn.execute(
        text("ALTER TABLE posts ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES admin_broadcasts(id) ON DELETE SET NULL")
    )
    await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_url VARCHAR(500)"))
    await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_type VARCHAR(50)"))
    await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_id VARCHAR(100)"))
    await conn.execute(
        text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS broadcast_id UUID REFERENCES admin_broadcasts(id) ON DELETE SET NULL")
    )
    await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ"))


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_schema_patches(conn)
