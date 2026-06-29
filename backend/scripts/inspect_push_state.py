#!/usr/bin/env python3
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.config.settings import get_settings
from app.database import AsyncSessionLocal


async def main() -> None:
    settings = get_settings()
    print("=== VAPID config ===")
    print("VAPID_PUBLIC_KEY set:", bool((settings.VAPID_PUBLIC_KEY or "").strip()))
    print("VAPID_PRIVATE_KEY set:", bool((settings.VAPID_PRIVATE_KEY or "").strip()))
    print("FRONTEND_URL:", settings.FRONTEND_URL)

    try:
        import pywebpush  # noqa: F401

        print("pywebpush installed: yes")
    except ImportError:
        print("pywebpush installed: NO")

    async with AsyncSessionLocal() as db:
        total = (await db.execute(text("SELECT COUNT(*) FROM push_tokens"))).scalar()
        web_sub = (
            await db.execute(
                text(
                    "SELECT COUNT(*) FROM push_tokens "
                    "WHERE platform = 'web' AND subscription_json IS NOT NULL"
                )
            )
        ).scalar()
        print(f"\n=== push_tokens table ===")
        print(f"total rows: {total}")
        print(f"web rows with subscription_json: {web_sub}")

        rows = (
            await db.execute(
                text(
                    "SELECT user_id, platform, "
                    "LENGTH(token) AS token_len, "
                    "LENGTH(subscription_json) AS sub_len, "
                    "created_at "
                    "FROM push_tokens ORDER BY created_at DESC LIMIT 10"
                )
            )
        ).all()
        for row in rows:
            print(" ", dict(row._mapping))

        broadcasts = (
            await db.execute(
                text(
                    "SELECT broadcast_type, send_browser_push, send_mobile_push, "
                    "push_delivery_count, created_at "
                    "FROM admin_broadcasts ORDER BY created_at DESC LIMIT 10"
                )
            )
        ).all()
        print(f"\n=== recent admin_broadcasts ===")
        for row in broadcasts:
            print(" ", dict(row._mapping))


if __name__ == "__main__":
    asyncio.run(main())
