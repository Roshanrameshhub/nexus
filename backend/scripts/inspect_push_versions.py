#!/usr/bin/env python3
"""Inspect push token subscription versions vs current VAPID key."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.config.settings import get_settings
from app.database import AsyncSessionLocal
from app.services.push_notification_service import get_vapid_subscription_version


async def main() -> None:
    settings = get_settings()
    current = get_vapid_subscription_version()
    print("=== VAPID subscription version ===")
    print("current_version:", current or "(not configured)")
    print("VAPID_PUBLIC_KEY set:", bool((settings.VAPID_PUBLIC_KEY or "").strip()))

    async with AsyncSessionLocal() as db:
        total = (await db.execute(text("SELECT COUNT(*) FROM push_tokens"))).scalar()
        if not current:
            print("\nNo VAPID public key — cannot compare versions.")
            print("total push_tokens:", total)
            return

        stale = (
            await db.execute(
                text(
                    "SELECT COUNT(*) FROM push_tokens "
                    "WHERE subscription_version IS NULL OR subscription_version != :current"
                ),
                {"current": current},
            )
        ).scalar()
        current_match = (
            await db.execute(
                text("SELECT COUNT(*) FROM push_tokens WHERE subscription_version = :current"),
                {"current": current},
            )
        ).scalar()
        print(f"\n=== push_tokens ({total} total) ===")
        print(f"stale (null or wrong version): {stale}")
        print(f"current version match: {current_match}")

        rows = (
            await db.execute(
                text(
                    "SELECT subscription_version, COUNT(*) AS cnt "
                    "FROM push_tokens GROUP BY subscription_version ORDER BY cnt DESC"
                )
            )
        ).all()
        print("\nBy subscription_version:")
        for row in rows:
            print(f"  {row[0]!r}: {row[1]}")


if __name__ == "__main__":
    asyncio.run(main())
