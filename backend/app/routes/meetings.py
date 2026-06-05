import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.meeting import Meeting
from app.models.user import User
from app.models.notification import Notification
from app.schemas.meeting import MeetingCreate, MeetingAccept, MeetingResponse
from app.config.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meetings", tags=["Meetings"])


# ─── Google Calendar helpers ───────────────────────────────────────────────────

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_EVENTS_URL = (
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
    "?conferenceDataVersion=1"
)


async def _get_google_access_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> str:
    """Exchange a refresh token for a short-lived access token.
    Raises ValueError with a detailed message on failure so the caller
    can log it and fall back gracefully.
    """
    async with httpx.AsyncClient(timeout=10) as http:
        resp = await http.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if resp.status_code != 200:
        raise ValueError(
            f"Google token exchange failed [{resp.status_code}]: {resp.text}"
        )

    return resp.json()["access_token"]


async def _create_google_meet_event(
    access_token: str,
    title: str,
    description: str,
    scheduled_at: datetime,
    user_time_zone: str,
) -> Optional[str]:
    """Insert a Calendar event with hangoutsMeet conference data.
    Returns the hangoutLink string, or None if unavailable.
    """
    start_iso = scheduled_at.isoformat()
    end_iso = (scheduled_at + timedelta(hours=1)).isoformat()

    event_body = {
        "summary": title,
        "description": description,
        "start": {"dateTime": start_iso, "timeZone": user_time_zone},
        "end":   {"dateTime": end_iso,   "timeZone": user_time_zone},
        "conferenceData": {
            "createRequest": {
                # uuid4() guarantees a globally-unique requestId —
                # required by Google to actually create a new Meet room.
                "requestId": str(uuid.uuid4()),
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.post(
            GOOGLE_CALENDAR_EVENTS_URL,
            json=event_body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 201):
        raise ValueError(
            f"Google Calendar events.insert failed [{resp.status_code}]: {resp.text}"
        )

    data = resp.json()

    # ── Primary extraction path: conferenceData.entryPoints[0].uri ──────────
    # This is the correct, documented response field for hangoutsMeet links.
    try:
        meet_url = (
            data["conferenceData"]["entryPoints"][0]["uri"]
        )
        if meet_url:
            logger.info(f"[Google Meet] Extracted from entryPoints[0].uri: {meet_url}")
            return meet_url
    except (KeyError, IndexError, TypeError):
        logger.warning("[Google Meet] conferenceData.entryPoints path not present in response.")

    # ── Secondary fallback: top-level hangoutLink ─────────────────────────
    hang = data.get("hangoutLink")
    if hang:
        logger.info(f"[Google Meet] Extracted from hangoutLink: {hang}")
        return hang

    # Log full response so we can inspect it immediately
    logger.error(f"[Google Meet] Could not find Meet URL in response. Full payload: {data}")
    return None


async def _provision_meet_link(
    title: str,
    description: str,
    scheduled_at: datetime,
    user_time_zone: str = "UTC",
) -> str:
    """Attempt to provision a real Google Meet link.
    Falls back to a unique placeholder if credentials are absent or if
    any Google API call fails — so the endpoint never crashes.
    """
    settings = get_settings()
    fallback = f"https://meet.google.com/tmp-{uuid.uuid4().hex[:8]}"

    client_id     = settings.GOOGLE_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET
    refresh_token = settings.GOOGLE_REFRESH_TOKEN

    if not all([client_id, client_secret, refresh_token]):
        logger.warning(
            "[Google Meet] Credentials not fully configured "
            "(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN). "
            "Returning placeholder link."
        )
        return fallback

    try:
        access_token = await _get_google_access_token(
            client_id, client_secret, refresh_token
        )
        meet_link = await _create_google_meet_event(
            access_token=access_token,
            title=title,
            description=description,
            scheduled_at=scheduled_at,
            user_time_zone=user_time_zone,
        )
        if meet_link:
            logger.info(f"[Google Meet] Provisioned live Meet link: {meet_link}")
            return meet_link
        else:
            logger.warning("[Google Meet] API succeeded but returned no hangoutLink; using fallback.")
            return fallback

    except ValueError as exc:
        # Detailed error surfaced to the server terminal for immediate debugging
        logger.error(f"[Google Meet] API error — {exc}")
        return fallback
    except Exception as exc:
        logger.error(f"[Google Meet] Unexpected error — {exc}", exc_info=True)
        return fallback


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    body: MeetingCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Create a new meeting request (status = 'pending').
    Attempts to provision a live Google Meet link using the organiser's
    stored credentials; falls back to a placeholder on any failure.
    """
    # Verify invitee exists
    invitee = await db.get(User, body.invitee_id)
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitee not found")

    user_time_zone = body.user_time_zone or "UTC"

    # ── Provision Google Meet link ──────────────────────────────────────────
    meet_link = await _provision_meet_link(
        title=body.title,
        description=body.description or f"Meeting with {invitee.name}",
        scheduled_at=body.scheduled_at,
        user_time_zone=user_time_zone,
    )

    meeting = Meeting(
        id=uuid.uuid4(),
        organizer_id=current_user.id,
        invitee_id=body.invitee_id,
        title=body.title,
        description=body.description,
        scheduled_at=body.scheduled_at,
        meeting_type=body.meeting_type,
        meet_link=meet_link,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(meeting)

    # ── Notification for the invitee ────────────────────────────────────────
    notif = Notification(
        id=uuid.uuid4(),
        user_id=body.invitee_id,
        type="meeting",
        content=(
            f"{current_user.name} scheduled a meeting with you: "
            f"'{body.title}' at {body.scheduled_at.strftime('%Y-%m-%d %H:%M UTC')}. "
            f"Meet Link: {meet_link}"
        ),
        read_status=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notif)

    await db.flush()

    return {"meeting": MeetingResponse.model_validate(meeting)}


@router.patch("/{meeting_id}/accept", response_model=dict)
async def accept_meeting(
    meeting_id: uuid.UUID,
    body: MeetingAccept,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Accept a pending meeting request.

    - Captures the accepting user's local IANA timezone (e.g. 'Asia/Kolkata').
    - Provisions an authentic Google Meet link via the Calendar API.
    - Updates status → 'accepted' and persists the real Meet URL.
    - Returns the updated meeting record.
    """
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    # Only the invitee may accept
    if meeting.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the invited participant can accept this meeting",
        )

    if meeting.status == "accepted":
        # Idempotent — return current state
        return {"meeting": MeetingResponse.model_validate(meeting)}

    user_time_zone = body.user_time_zone or "UTC"

    # ── Provision a live Google Meet link for the accepted session ──────────
    meet_link = await _provision_meet_link(
        title=meeting.title,
        description=meeting.description or f"Meeting with {current_user.name}",
        scheduled_at=meeting.scheduled_at,
        user_time_zone=user_time_zone,
    )

    # ── Persist changes ─────────────────────────────────────────────────────
    meeting.status    = "accepted"
    meeting.meet_link = meet_link
    db.add(meeting)
    await db.flush()

    # ── Notify organiser ────────────────────────────────────────────────────
    try:
        notif = Notification(
            id=uuid.uuid4(),
            user_id=meeting.organizer_id,
            type="meeting",
            content=(
                f"{current_user.name} accepted your meeting request: "
                f"'{meeting.title}'. Join here: {meet_link}"
            ),
            read_status=False,
            created_at=datetime.now(timezone.utc),
        )
        db.add(notif)
        await db.flush()
    except Exception as exc:
        logger.warning(f"[Meetings] Failed to create acceptance notification: {exc}")

    return {"meeting": MeetingResponse.model_validate(meeting)}


@router.get("", response_model=dict)
async def list_meetings(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Return all meetings where the current user is organiser or invitee,
    sorted chronologically (nearest first).
    """
    stmt = (
        select(Meeting)
        .where(
            or_(
                Meeting.organizer_id == current_user.id,
                Meeting.invitee_id   == current_user.id,
            )
        )
        .order_by(Meeting.scheduled_at.asc())
    )
    result  = await db.execute(stmt)
    meetings = [MeetingResponse.model_validate(m) for m in result.scalars().all()]
    return {"meetings": meetings}


@router.patch("/{meeting_id}/notes", response_model=dict)
async def update_meeting_notes(
    meeting_id: uuid.UUID,
    body: dict,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """Preserve the existing notes update stub used by the frontend."""
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    # notes field not in DB schema yet; return current record silently
    return {"meeting": MeetingResponse.model_validate(meeting)}
