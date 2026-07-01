"""Update credentials for the existing SUPER_ADMIN account.

Finds the user with platform_role = SUPER_ADMIN and updates only email + password.
Does not create users or modify roles/permissions.

Usage (from backend/):
    SUPER_ADMIN_PASSWORD='your-new-password' python create_admin.py

Optional:
    SUPER_ADMIN_EMAIL=admin.rconnectx@gmail.com
"""
from __future__ import annotations

import asyncio
import os
import sys

from sqlalchemy import select

from app.core.security import get_password_hash, verify_password
from app.database import AsyncSessionLocal
from app.models.platform import PlatformRole
from app.models.user import User

DEFAULT_ADMIN_EMAIL = "admin.rconnectx@gmail.com"


def _new_admin_email() -> str:
    return os.environ.get("SUPER_ADMIN_EMAIL", DEFAULT_ADMIN_EMAIL).strip().lower()


def _new_admin_password() -> str:
    password = os.environ.get("SUPER_ADMIN_PASSWORD", "").strip()
    if not password:
        print(
            "Error: set SUPER_ADMIN_PASSWORD before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)
    return password


async def update_super_admin_credentials() -> int:
    new_email = _new_admin_email()
    new_password = _new_admin_password()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.platform_role == PlatformRole.SUPER_ADMIN.value)
        )
        super_admins = result.scalars().all()

        if not super_admins:
            print("Error: no user with platform_role SUPER_ADMIN found.", file=sys.stderr)
            return 1

        if len(super_admins) > 1:
            emails = ", ".join(user.email for user in super_admins)
            print(
                f"Error: multiple SUPER_ADMIN accounts found ({emails}). "
                "Resolve manually before running this script.",
                file=sys.stderr,
            )
            return 1

        admin = super_admins[0]
        previous_email = admin.email

        if previous_email != new_email:
            conflict = await db.execute(
                select(User).where(
                    User.email == new_email,
                    User.id != admin.id,
                )
            )
            if conflict.scalar_one_or_none():
                print(
                    f"Error: {new_email!r} is already used by another account.",
                    file=sys.stderr,
                )
                return 1
            admin.email = new_email

        admin.hashed_password = get_password_hash(new_password)

        await db.commit()
        await db.refresh(admin)

        if not verify_password(new_password, admin.hashed_password):
            print("Error: password hash verification failed after update.", file=sys.stderr)
            return 1

        print("SUPER_ADMIN credentials updated successfully.")
        print(f"  User id: {admin.id}")
        if previous_email != admin.email:
            print(f"  Email: {previous_email} -> {admin.email}")
        else:
            print(f"  Email: {admin.email}")
        print("  Password: updated (bcrypt hash stored)")
        return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(update_super_admin_credentials()))
