"""One-time script: promote a user to SUPER_ADMIN by email.

Usage (from backend/):
    python scripts/promote_super_admin.py your@email.com
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select, update

# Allow imports from backend/app when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models.platform import PlatformRole
from app.models.user import User


async def promote(email: str) -> int:
    normalized = email.strip().lower()
    if not normalized:
        print("Error: email must not be empty.", file=sys.stderr)
        return 1

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == normalized))
        user = result.scalar_one_or_none()

        if user is None:
            # Case-insensitive fallback for existing accounts.
            result = await db.execute(
                select(User).where(User.email.ilike(normalized))
            )
            user = result.scalar_one_or_none()

        if user is None:
            print(f"Error: no user found with email {normalized!r}.", file=sys.stderr)
            print("Sign up first, then run this script again.", file=sys.stderr)
            return 1

        if user.platform_role == PlatformRole.SUPER_ADMIN.value:
            print(f"Already SUPER_ADMIN: {user.email} (id={user.id})")
            return 0

        await db.execute(
            update(User)
            .where(User.id == user.id)
            .values(platform_role=PlatformRole.SUPER_ADMIN.value)
        )
        await db.commit()

        print(f"Promoted to SUPER_ADMIN: {user.email} (id={user.id})")
        print("Log out and log back in (or refresh) to access /admin.")
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Promote a Nexus user to SUPER_ADMIN by email."
    )
    parser.add_argument("email", help="Account email address")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(promote(args.email)))


if __name__ == "__main__":
    main()
