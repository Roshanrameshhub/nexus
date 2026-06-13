"""TEMP DATABASE DIAGNOSTIC — shared helpers; delete with debug routes and script."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import dotenv_values

from app.config.settings import Settings, get_settings

# TEMP DATABASE DIAGNOSTIC
DEFAULT_DATABASE_URL = Settings.model_fields["DATABASE_URL"].default


def backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_env_file_path() -> Path:
    """Pydantic loads env_file='.env' relative to cwd at Settings() instantiation."""
    return Path.cwd() / ".env"


def mask_database_url(url: str) -> str:
    parsed = urlparse(url)
    user = parsed.username or ""
    host = parsed.hostname or ""
    port = f":{parsed.port}" if parsed.port else ""
    db = parsed.path or ""
    if user:
        return f"{parsed.scheme}://{user}:***@{host}{port}{db}"
    return f"{parsed.scheme}://{host}{port}{db}"


def parse_database_url(url: str) -> dict[str, str | None]:
    parsed = urlparse(url)
    return {
        "host": parsed.hostname,
        "port": str(parsed.port) if parsed.port else None,
        "database": parsed.path.lstrip("/") if parsed.path else None,
        "user": parsed.username,
    }


def resolve_database_source() -> dict[str, Any]:
    # TEMP DATABASE DIAGNOSTIC
    settings = get_settings()
    cwd = Path.cwd()
    env_file_path = resolve_env_file_path()
    backend_env_path = backend_root() / ".env"

    os_database_url = os.environ.get("DATABASE_URL")
    cwd_dotenv_url = None
    backend_dotenv_url = None

    if env_file_path.exists():
        cwd_dotenv_url = dotenv_values(env_file_path).get("DATABASE_URL")
    if backend_env_path.exists():
        backend_dotenv_url = dotenv_values(backend_env_path).get("DATABASE_URL")

    active_url = settings.DATABASE_URL
    parsed = parse_database_url(active_url)

    if os_database_url and os_database_url == active_url:
        source = "environment_variable"
    elif cwd_dotenv_url and cwd_dotenv_url == active_url:
        source = "env_file"
    elif backend_dotenv_url and backend_dotenv_url == active_url:
        source = "env_file"
    elif active_url == DEFAULT_DATABASE_URL:
        source = "settings_default"
    elif os_database_url:
        source = "environment_variable"
    elif cwd_dotenv_url or backend_dotenv_url:
        source = "env_file"
    else:
        source = "unknown"

    return {
        "host": parsed["host"],
        "database": parsed["database"],
        "cwd": str(cwd),
        "source": source,
        "database_url": mask_database_url(active_url),
        "env_file_path_used_by_pydantic": str(env_file_path),
        "env_file_exists_at_cwd": env_file_path.exists(),
        "env_file_exists_at_backend_root": backend_env_path.exists(),
        "backend_env_file_path": str(backend_env_path),
        "from_environment_variable": bool(os_database_url),
        "from_env_file": source == "env_file",
        "os_environ_database_url_set": bool(os_database_url),
        "cwd_dotenv_database_url_set": bool(cwd_dotenv_url),
        "backend_dotenv_database_url_set": bool(backend_dotenv_url),
        "matches_settings_default": active_url == DEFAULT_DATABASE_URL,
    }


def startup_database_log_lines() -> list[str]:
    # TEMP DATABASE DIAGNOSTIC
    info = resolve_database_source()
    return [
        "TEMP DATABASE DIAGNOSTIC startup",
        f"  cwd: {info['cwd']}",
        f"  DATABASE_URL host: {info['host']}",
        f"  database name: {info['database']}",
        f"  pydantic .env path: {info['env_file_path_used_by_pydantic']}",
        f"  .env exists (cwd): {info['env_file_exists_at_cwd']}",
        f"  .env exists (backend root): {info['env_file_exists_at_backend_root']}",
        f"  config source: {info['source']}",
        f"  DATABASE_URL (masked): {info['database_url']}",
    ]
