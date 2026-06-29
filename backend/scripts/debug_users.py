"""Print database host, user count, and sample emails for debugging.

Usage (from backend/):
    python scripts/debug_users.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from urllib.parse import urlparse

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.settings import get_settings
from app.database import engine


def database_host(database_url: str) -> str:
    parsed = urlparse(database_url)
    host = parsed.hostname or "(unknown)"
    if parsed.port:
        return f"{host}:{parsed.port}"
    return host


async def run() -> int:
    settings = get_settings()
    print(f"DATABASE_URL host: {database_host(settings.DATABASE_URL)}")

    async with engine.connect() as conn:
        total = (await conn.execute(text("SELECT count(*) FROM users"))).scalar_one()
        print(f"Total users: {total}")

        rows = (
            await conn.execute(
                text(
                    "SELECT email FROM users ORDER BY created_at ASC NULLS LAST LIMIT 20"
                )
            )
        ).fetchall()

    print("First 20 user emails:")
    if not rows:
        print("  (none)")
    else:
        for i, (email,) in enumerate(rows, start=1):
            print(f"  {i:2}. {email}")

    return 0


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()
