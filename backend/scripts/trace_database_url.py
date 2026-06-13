"""Trace where DATABASE_URL is loaded from. Run: python scripts/trace_database_url.py"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from dotenv import dotenv_values
from app.config.settings import Settings, get_settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = BACKEND_ROOT / ".env"
DEFAULT_URL = Settings.model_fields["DATABASE_URL"].default


def host_of(url: str) -> str:
    p = urlparse(url)
    return f"{p.hostname or '(none)'}:{p.port or '(default)'}"


def main() -> None:
    print("=== 1. Working directory ===")
    print(f"cwd: {Path.cwd()}")
    print(f"backend/.env path: {ENV_PATH}")
    print(f"backend/.env exists: {ENV_PATH.exists()}")
    print(f"cwd/.env exists: {(Path.cwd() / '.env').exists()}")

    print("\n=== 2. OS environment (os.environ) ===")
    os_val = os.environ.get("DATABASE_URL")
    print(f"os.environ['DATABASE_URL'] set: {bool(os_val)}")
    if os_val:
        print(f"os.environ host: {host_of(os_val)}")

    print("\n=== 3. dotenv parse of backend/.env ===")
    if ENV_PATH.exists():
        raw = ENV_PATH.read_text(encoding="utf-8")
        for i, line in enumerate(raw.splitlines(), 1):
            if line.strip().startswith("DATABASE_URL"):
                print(f"line {i} raw: {line!r}")
        parsed = dotenv_values(ENV_PATH)
        dv = parsed.get("DATABASE_URL")
        print(f"dotenv_values DATABASE_URL set: {bool(dv)}")
        if dv:
            print(f"dotenv_values host: {host_of(dv)}")
            print(f"dotenv_values length: {len(dv)} chars")
    else:
        print("backend/.env not found")

    print("\n=== 4. Pydantic Settings (app/config/settings.py) ===")
    print(f"env_file config: {Settings.model_config.get('env_file')!r} (relative to cwd)")
    print(f"code default host: {host_of(DEFAULT_URL)}")

    settings = get_settings()
    print(f"get_settings() host: {host_of(settings.DATABASE_URL)}")
    print(f"matches code default: {settings.DATABASE_URL == DEFAULT_URL}")

    print("\n=== 5. Resolution order (pydantic-settings) ===")
    print("1. OS environment variable DATABASE_URL (if set)")
    print("2. .env file (path relative to cwd, not settings.py)")
    print("3. Field default in settings.py line 21")


if __name__ == "__main__":
    main()
