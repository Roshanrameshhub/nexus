#!/usr/bin/env python3
"""Attempt one Web Push send using the newest push_tokens row."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from app.config.settings import get_settings
from app.database import AsyncSessionLocal
from app.services.push_notification_service import _normalize_private_key, _run_web_push


async def main() -> None:
    settings = get_settings()
    private = _normalize_private_key(settings.VAPID_PRIVATE_KEY or "")
    print("private key configured:", bool(private))

    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text(
                    "SELECT subscription_json FROM push_tokens "
                    "WHERE platform = 'web' AND subscription_json IS NOT NULL "
                    "ORDER BY created_at DESC LIMIT 1"
                )
            )
        ).first()
        if not row:
            print("No subscription in database")
            return
        sub = row[0]
        print("subscription endpoint:", json.loads(sub).get("endpoint", "")[:80])

    ok, status = _run_web_push(sub, "Test", "Push diagnostic", "/notifications")
    print("send result:", ok, "status:", status)


if __name__ == "__main__":
    asyncio.run(main())
