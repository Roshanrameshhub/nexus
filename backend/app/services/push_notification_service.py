from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Iterable
from uuid import UUID

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.models.push_token import PushToken

logger = logging.getLogger(__name__)


@dataclass
class PushSendResult:
    delivered: int = 0
    recipient_user_count: int = 0
    tokens_found: int = 0
    tokens_attempted: int = 0
    tokens_failed: int = 0
    tokens_skipped: int = 0
    tokens_removed: int = 0
    skip_reason: str | None = None
    failure_details: list[str] = field(default_factory=list)


def _normalize_private_key(raw: str) -> str:
    key = raw.strip().strip('"').strip("'")
    if "\\n" in key:
        key = key.replace("\\n", "\n")
    return key.replace("\r\n", "\n").replace("\r", "\n")


def _public_key_b64url_from_vapid(vapid) -> str:
    from cryptography.hazmat.primitives import serialization

    raw = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _load_vapid(private_key_raw: str):
    """Load VAPID credentials the way pywebpush expects (from_pem bytes, not from_string)."""
    from py_vapid import Vapid

    normalized = _normalize_private_key(private_key_raw)
    if not normalized:
        raise ValueError("VAPID_PRIVATE_KEY is empty")
    return Vapid.from_pem(normalized.encode("utf-8"))


def get_vapid_subscription_version() -> str | None:
    """Stable version id for the active VAPID public key (rotates when keys change)."""
    public_key = getattr(get_settings(), "VAPID_PUBLIC_KEY", "")
    if not public_key:
        return None
    return hashlib.sha256(public_key.encode("utf-8")).hexdigest()[:16]


async def purge_stale_push_subscriptions(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
) -> int:
    """Remove subscriptions created under a different VAPID key (or before versioning)."""
    current = get_vapid_subscription_version()
    if not current:
        return 0

    stale_filter = or_(
        PushToken.subscription_version.is_(None),
        PushToken.subscription_version != current,
    )
    stmt = delete(PushToken).where(stale_filter)
    if user_id is not None:
        stmt = stmt.where(PushToken.user_id == user_id)

    result = await db.execute(stmt)
    removed = result.rowcount or 0
    if removed:
        scope = f"user={user_id}" if user_id else "all users"
        logger.warning(
            "Purged %s stale push subscription(s) scope=%s current_version=%s",
            removed,
            scope,
            current,
        )
        await db.flush()
    return removed


def validate_vapid_private_key(raw: str) -> tuple[bool, str]:
    """Validate using py_vapid.from_pem — same loader pywebpush needs at send time."""
    try:
        _load_vapid(raw)
        return True, ""
    except Exception as exc:
        return False, str(exc)


def validate_vapid_key_pair(public_key: str, private_key_raw: str) -> tuple[bool, str]:
    public_key = (public_key or "").strip()
    if not public_key:
        return False, "VAPID_PUBLIC_KEY is empty"
    try:
        vapid = _load_vapid(private_key_raw)
        derived = _public_key_b64url_from_vapid(vapid)
    except Exception as exc:
        return False, f"private key load failed: {exc}"
    if derived != public_key:
        return False, "VAPID_PUBLIC_KEY does not match VAPID_PRIVATE_KEY"
    return True, ""


def absolute_push_link(link_url: str | None) -> str:
    settings = get_settings()
    base = (settings.FRONTEND_URL or "http://localhost:3000").rstrip("/")
    if not link_url:
        return f"{base}/notifications"
    if link_url.startswith("http://") or link_url.startswith("https://"):
        return link_url
    path = link_url if link_url.startswith("/") else f"/{link_url}"
    return f"{base}{path}"


def _run_web_push(
    subscription_json: str,
    title: str,
    body: str,
    link_url: str | None,
) -> tuple[bool, int | None, str | None]:
    """Returns (success, http_status_if_error, error_message)."""
    settings = get_settings()
    public_key = (settings.VAPID_PUBLIC_KEY or "").strip()

    try:
        vapid = _load_vapid(settings.VAPID_PRIVATE_KEY or "")
    except Exception as exc:
        logger.exception("VAPID private key failed to load for web push")
        return False, None, f"VAPID private key load failed: {exc}"

    pair_ok, pair_error = validate_vapid_key_pair(public_key, settings.VAPID_PRIVATE_KEY or "")
    if not pair_ok:
        logger.error("VAPID key pair invalid: %s", pair_error)
        return False, None, pair_error

    try:
        from pywebpush import WebPushException, webpush
    except ImportError:
        logger.exception("pywebpush is not installed")
        return False, None, "pywebpush is not installed on the server"

    claims_email = (settings.VAPID_CLAIMS_EMAIL or "mailto:admin@rconnectx.com").strip()
    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "link_url": absolute_push_link(link_url),
        }
    )

    try:
        subscription = json.loads(subscription_json)
    except json.JSONDecodeError as exc:
        return False, None, f"Invalid subscription_json: {exc}"

    endpoint = subscription.get("endpoint")
    keys = subscription.get("keys") or {}
    if not endpoint:
        return False, None, "subscription_json missing endpoint"
    if not keys.get("p256dh") or not keys.get("auth"):
        return False, None, "subscription_json missing keys.p256dh or keys.auth"

    logger.warning(
        "webpush() calling endpoint=%s p256dh_len=%s auth_len=%s",
        str(endpoint)[:72],
        len(str(keys.get("p256dh", ""))),
        len(str(keys.get("auth", ""))),
    )

    try:
        response = webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=vapid,
            vapid_claims={"sub": claims_email},
        )
        status_code = getattr(response, "status_code", 201)
        logger.warning("webpush() success endpoint=%s status=%s", str(endpoint)[:72], status_code)
        return True, status_code, None
    except WebPushException as exc:
        status = getattr(exc, "response", None)
        code = getattr(status, "status_code", None) if status is not None else None
        body_text = ""
        if status is not None:
            try:
                body_text = (getattr(status, "text", "") or "")[:500]
            except Exception:
                body_text = ""
        message = f"WebPushException status={code} body={body_text or str(exc)}"
        logger.warning(
            "webpush() failed endpoint=%s %s",
            str(endpoint)[:72],
            message,
            exc_info=True,
        )
        return False, code, message
    except Exception as exc:
        logger.exception("webpush() failed endpoint=%s", str(endpoint)[:72])
        return False, None, str(exc)


async def send_push_to_users(
    db: AsyncSession,
    user_ids: Iterable[UUID],
    *,
    title: str,
    body: str,
    link_url: str | None,
    platforms: list[str],
) -> PushSendResult:
    result = PushSendResult()
    user_id_list = list(user_ids)
    result.recipient_user_count = len(user_id_list)

    logger.warning(
        "send_push_to_users start recipients=%s platforms=%s title=%r",
        result.recipient_user_count,
        platforms,
        title,
    )

    if "web" not in platforms:
        result.skip_reason = "web platform not requested"
        logger.warning("send_push_to_users skipped: %s", result.skip_reason)
        return result

    settings = get_settings()
    public_key = (settings.VAPID_PUBLIC_KEY or "").strip()
    private_raw = settings.VAPID_PRIVATE_KEY or ""

    if not public_key or not private_raw.strip():
        result.skip_reason = "VAPID_PUBLIC_KEY and/or VAPID_PRIVATE_KEY are not configured"
        logger.error("send_push_to_users skipped: %s", result.skip_reason)
        return result

    valid, validation_error = validate_vapid_private_key(private_raw)
    if not valid:
        result.skip_reason = f"Invalid VAPID_PRIVATE_KEY: {validation_error}"
        logger.error("send_push_to_users skipped: %s", result.skip_reason)
        return result

    pair_ok, pair_error = validate_vapid_key_pair(public_key, private_raw)
    if not pair_ok:
        result.skip_reason = f"VAPID key pair invalid: {pair_error}"
        logger.error("send_push_to_users skipped: %s", result.skip_reason)
        return result

    if not user_id_list:
        result.skip_reason = "no recipient users matched audience filters"
        logger.warning("send_push_to_users skipped: %s", result.skip_reason)
        return result

    current_version = get_vapid_subscription_version()
    await purge_stale_push_subscriptions(db)

    token_rows = (
        await db.execute(
            select(PushToken).where(
                PushToken.user_id.in_(user_id_list),
                PushToken.platform == "web",
                PushToken.subscription_json.isnot(None),
                PushToken.subscription_version == current_version,
            )
        )
    ).scalars().all()

    result.tokens_found = len(token_rows)
    logger.warning(
        "send_push_to_users tokens_found=%s for recipients=%s",
        result.tokens_found,
        result.recipient_user_count,
    )

    if not token_rows:
        result.skip_reason = (
            "no web push subscriptions found for targeted users "
            "(users must grant permission while logged in)"
        )
        logger.warning("send_push_to_users skipped: %s", result.skip_reason)
        return result

    for token_row in token_rows:
        if not (token_row.subscription_json or "").strip():
            result.tokens_skipped += 1
            result.failure_details.append(f"user={token_row.user_id} skipped: empty subscription_json")
            continue

        result.tokens_attempted += 1
        success, status_code, error_message = await asyncio.to_thread(
            _run_web_push,
            token_row.subscription_json or "",
            title,
            body,
            link_url,
        )
        if success:
            result.delivered += 1
            continue

        result.tokens_failed += 1
        if error_message:
            result.failure_details.append(
                f"user={token_row.user_id} endpoint={token_row.token[:48]}... error={error_message}"
            )

        if status_code in (404, 410):
            await db.execute(delete(PushToken).where(PushToken.id == token_row.id))
            result.tokens_removed += 1
            logger.warning("Removed expired push token user=%s status=%s", token_row.user_id, status_code)

    if result.delivered == 0 and not result.skip_reason:
        result.skip_reason = (
            f"all {result.tokens_attempted} push attempts failed; "
            "see push_failure_samples and server logs"
        )

    logger.warning(
        "send_push_to_users complete delivered=%s attempted=%s failed=%s removed=%s skip_reason=%s",
        result.delivered,
        result.tokens_attempted,
        result.tokens_failed,
        result.tokens_removed,
        result.skip_reason,
    )
    return result
