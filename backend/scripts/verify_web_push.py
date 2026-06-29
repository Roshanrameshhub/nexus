#!/usr/bin/env python3
"""Verify Web Push configuration and pywebpush installation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config.settings import get_settings
from app.services.push_notification_service import (
    validate_vapid_key_pair,
    validate_vapid_private_key,
)


def main() -> int:
    settings = get_settings()
    public_key = (settings.VAPID_PUBLIC_KEY or "").strip()
    private_key = (settings.VAPID_PRIVATE_KEY or "").strip()
    frontend = (settings.FRONTEND_URL or "").strip()

    errors: list[str] = []
    if not public_key:
        errors.append("VAPID_PUBLIC_KEY is missing")
    if not private_key:
        errors.append("VAPID_PRIVATE_KEY is missing")
    if not frontend:
        errors.append("FRONTEND_URL is missing (needed for notification click URLs)")

    private_valid, private_error = validate_vapid_private_key(private_key)
    if not private_valid:
        errors.append(f"VAPID_PRIVATE_KEY invalid: {private_error}")

    pair_valid, pair_error = validate_vapid_key_pair(public_key, private_key)
    if not pair_valid:
        errors.append(f"VAPID key pair invalid: {pair_error}")

    try:
        import pywebpush  # noqa: F401
    except ImportError:
        errors.append("pywebpush is not installed (pip install pywebpush)")

    if errors:
        print("Web Push verification FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("Web Push verification OK")
    print(f"  FRONTEND_URL={frontend}")
    print(f"  VAPID_PUBLIC_KEY length={len(public_key)}")
    print(f"  VAPID_PRIVATE_KEY length={len(private_key)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
