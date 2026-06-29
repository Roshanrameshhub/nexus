"""TEMP DATABASE DIAGNOSTIC — delete when investigation is complete.

Usage (from backend/):
    python scripts/database_diagnostic.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import engine
from app.diagnostics.database_temp import resolve_database_source


async def run() -> int:
    # TEMP DATABASE DIAGNOSTIC
    info = resolve_database_source()

    print("=== DATABASE DIAGNOSTIC ===")
    print()
    print(f"cwd: {info['cwd']}")
    print(f"resolved .env: {info['env_file_path_used_by_pydantic']}")
    print(f"env exists: {info['env_file_exists_at_cwd']}")
    print(f"backend .env path: {info['backend_env_file_path']}")
    print(f"backend .env exists: {info['env_file_exists_at_backend_root']}")
    print(f"database host: {info['host']}")
    print(f"database name: {info['database']}")
    print(f"config source: {info['source']}")
    print(f"database url masked: {info['database_url']}")

    async with engine.connect() as conn:
        user_count = (await conn.execute(text("SELECT count(*) FROM users"))).scalar_one()

    print(f"user count: {user_count}")
    return 0


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()
