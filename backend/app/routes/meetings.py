import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.meeting import Meeting
from app.models.user import User
from app.models.notification import Notification
from app.schemas.meeting import (
    MeetingCreate,
    MeetingAccept,
    MeetingReschedule,
    MeetingNotesUpdate,
    MeetingResponse,
)
from app.config.settings import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meetings", tags=["Meetings"])

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events"


async def _get_google_access_token(
    client_id: str,
    client_secret: str,
    refresh_token: str,
) -> str:
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


def _extract_meet_url(data: dict) -> Optional[str]:
    meet_url = data.get("conferenceData", {}).get("entryPoints", [{}])[0].get("uri")
    if meet_url:
        return meet_url
    return data.get("hangoutLink")


async def _create_google_meet_event(
    access_token: str,
    title: str,
    description: str,
    start_time: datetime,
    duration_minutes: int,
    user_time_zone: str,
) -> tuple[Optional[str], Optional[str]]:
    start_iso = start_time.isoformat()
    end_iso = (start_time + timedelta(minutes=duration_minutes)).isoformat()

    event_body = {
        "summary": title,
        "description": description,
        "start": {"dateTime": start_iso, "timeZone": user_time_zone},
        "end": {"dateTime": end_iso, "timeZone": user_time_zone},
        "conferenceData": {
            "createRequest": {
                "requestId": uuid.uuid4().hex,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
    }

    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.post(
            f"{GOOGLE_CALENDAR_BASE}?conferenceDataVersion=1",
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
    meet_url = _extract_meet_url(data)
    event_id = data.get("id")
    if meet_url:
        logger.info(f"[Google Meet] Created event {event_id}: {meet_url}")
    else:
        logger.error(f"[Google Meet] No Meet URL in create response: {data}")
    return meet_url, event_id


async def _update_google_calendar_event(
    access_token: str,
    event_id: str,
    title: str,
    description: str,
    start_time: datetime,
    duration_minutes: int,
    user_time_zone: str,
) -> Optional[str]:
    start_iso = start_time.isoformat()
    end_iso = (start_time+ timedelta(minutes=duration_minutes)).isoformat()

    event_body = {
        "summary": title,
        "description": description,
        "start": {"dateTime": start_iso, "timeZone": user_time_zone},
        "end": {"dateTime": end_iso, "timeZone": user_time_zone},
    }

    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.patch(
            f"{GOOGLE_CALENDAR_BASE}/{event_id}?conferenceDataVersion=1",
            json=event_body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code not in (200, 201):
        raise ValueError(
            f"Google Calendar events.update failed [{resp.status_code}]: {resp.text}"
        )

    data = resp.json()
    return _extract_meet_url(data)


async def _delete_google_calendar_event(access_token: str, event_id: str) -> None:
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.delete(
            f"{GOOGLE_CALENDAR_BASE}/{event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if resp.status_code not in (200, 204, 410):
        raise ValueError(
            f"Google Calendar events.delete failed [{resp.status_code}]: {resp.text}"
        )


async def _get_google_credentials() -> Optional[tuple[str, str, str]]:
    settings = get_settings()
    client_id = settings.GOOGLE_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET
    refresh_token = settings.GOOGLE_REFRESH_TOKEN
    if not all([client_id, client_secret, refresh_token]):
        logger.warning("[Google Meet] Credentials not fully configured.")
        return None
    return client_id, client_secret, refresh_token


async def _provision_meet_link(
    title: str,
    description: str,
    start_time: datetime,
    duration_minutes: int,
    user_time_zone: str = "UTC",
) -> tuple[str, Optional[str]]:
    creds = await _get_google_credentials()
    if not creds:
        return "", None

    client_id, client_secret, refresh_token = creds
    try:
        access_token = await _get_google_access_token(
            client_id, client_secret, refresh_token
        )
        meet_link, event_id = await _create_google_meet_event(
            access_token=access_token,
            title=title,
            description=description,
            start_time=start_time,
            duration_minutes=duration_minutes,
            user_time_zone=user_time_zone,
        )
        return meet_link or "", event_id
    except (ValueError, Exception) as exc:
        logger.error(f"[Google Meet] Provision error — {exc}")
        return "", None


async def _update_meet_calendar(
    event_id: str,
    title: str,
    description: str,
    start_time: datetime,
    duration_minutes: int,
    user_time_zone: str,
) -> Optional[str]:
    creds = await _get_google_credentials()
    if not creds:
        return None

    client_id, client_secret, refresh_token = creds
    try:
        access_token = await _get_google_access_token(
            client_id, client_secret, refresh_token
        )
        return await _update_google_calendar_event(
            access_token=access_token,
            event_id=event_id,
            title=title,
            description=description,
            start_time=start_time,
            duration_minutes=duration_minutes,
            user_time_zone=user_time_zone,
        )
    except (ValueError, Exception) as exc:
        logger.error(f"[Google Meet] Update error — {exc}")
        return None


async def _cancel_meet_calendar(event_id: str) -> None:
    creds = await _get_google_credentials()
    if not creds:
        return

    client_id, client_secret, refresh_token = creds
    try:
        access_token = await _get_google_access_token(
            client_id, client_secret, refresh_token
        )
        await _delete_google_calendar_event(access_token, event_id)
    except (ValueError, Exception) as exc:
        logger.error(f"[Google Meet] Cancel calendar error — {exc}")


async def _create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    content: str,
) -> None:
    notif = Notification(
        id=uuid.uuid4(),
        user_id=user_id,
        type="meeting",
        content=content,
        read_status=False,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notif)


def _meeting_response(meeting: Meeting) -> dict:
    """Serialize a meeting without triggering async lazy-loads on relationships."""
    state = sa_inspect(meeting)
    payload = {
        "id": meeting.id,
        "organizer_id": meeting.organizer_id,
        "invitee_id": meeting.invitee_id,
        "title": meeting.title,
        "description": meeting.description,
        "start_time": meeting.start_time,
        "meeting_type": meeting.meeting_type,
        "duration_minutes": meeting.duration_minutes or 60,
        "meet_link": meeting.meet_link or "",
        "meeting_provider": meeting.meeting_provider or "google_meet",
        "calendar_event_id": meeting.calendar_event_id,
        "notes": meeting.notes,
        "status": meeting.status,
        "created_at": meeting.created_at,
        "organizer": None if "organizer" in state.unloaded else meeting.organizer,
        "invitee": None if "invitee" in state.unloaded else meeting.invitee,
    }
    return {"meeting": MeetingResponse.model_validate(payload)}


def _is_participant(meeting: Meeting, user_id: uuid.UUID) -> bool:
    return meeting.organizer_id == user_id or meeting.invitee_id == user_id


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    body: MeetingCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    invitee = await db.get(User, body.invitee_id)
    if not invitee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitee not found")
    if body.invitee_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule a session with yourself",
        )

    user_time_zone = body.user_time_zone or "UTC"
    description = body.description or f"Session with {invitee.name}"

    meet_link, calendar_event_id = await _provision_meet_link(
        title=body.title,
        description=description,
        start_time=body.start_time,
        duration_minutes=body.duration_minutes,
        user_time_zone=user_time_zone,
    )

    meeting = Meeting(
        id=uuid.uuid4(),
        organizer_id=current_user.id,
        invitee_id=body.invitee_id,
        title=body.title,
        description=body.description,
        start_time=body.start_time,
        meeting_type=body.meeting_type,
        duration_minutes=body.duration_minutes,
        meet_link=meet_link,
        meeting_provider="google_meet",
        calendar_event_id=calendar_event_id,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(meeting)

    link_text = f" Meet Link: {meet_link}" if meet_link else ""
    await _create_notification(
        db,
        body.invitee_id,
        (
            f"{current_user.name} scheduled a session with you: "
            f"'{body.title}' at {body.start_time.strftime('%Y-%m-%d %H:%M UTC')}."
            f"{link_text}"
        ),
    )

    await db.flush()
    return _meeting_response(meeting)


@router.patch("/{meeting_id}/accept", response_model=dict)
async def accept_meeting(
    meeting_id: uuid.UUID,
    body: MeetingAccept,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if meeting.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the invited participant can accept this meeting",
        )

    if meeting.status in ("confirmed", "accepted"):
        return _meeting_response(meeting)

    if meeting.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot accept a cancelled meeting",
        )

    meeting.status = "confirmed"
    db.add(meeting)
    await db.flush()

    organizer = await db.get(User, meeting.organizer_id)
    organizer_name = organizer.name if organizer else "The organizer"
    link_text = f" Join here: {meeting.meet_link}" if meeting.meet_link else ""
    await _create_notification(
        db,
        meeting.organizer_id,
        (
            f"{current_user.name} accepted your session request: "
            f"'{meeting.title}'.{link_text}"
        ),
    )
    await db.flush()

    return _meeting_response(meeting)


@router.patch("/{meeting_id}/decline", response_model=dict)
async def decline_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if meeting.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the invited participant can decline this meeting",
        )

    if meeting.status == "cancelled":
        return _meeting_response(meeting)

    if meeting.calendar_event_id:
        await _cancel_meet_calendar(meeting.calendar_event_id)

    meeting.status = "cancelled"
    db.add(meeting)
    await db.flush()

    await _create_notification(
        db,
        meeting.organizer_id,
        f"{current_user.name} declined your session request: '{meeting.title}'.",
    )
    await db.flush()

    return _meeting_response(meeting)


@router.patch("/{meeting_id}/cancel", response_model=dict)
async def cancel_meeting(
    meeting_id: uuid.UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if not _is_participant(meeting, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only session participants can cancel this meeting",
        )

    if meeting.status == "cancelled":
        return _meeting_response(meeting)

    if meeting.calendar_event_id:
        await _cancel_meet_calendar(meeting.calendar_event_id)

    meeting.status = "cancelled"
    db.add(meeting)
    await db.flush()

    other_id = (
        meeting.invitee_id
        if meeting.organizer_id == current_user.id
        else meeting.organizer_id
    )
    await _create_notification(
        db,
        other_id,
        f"{current_user.name} cancelled the session: '{meeting.title}'.",
    )
    await db.flush()

    return _meeting_response(meeting)


@router.patch("/{meeting_id}/reschedule", response_model=dict)
async def reschedule_meeting(
    meeting_id: uuid.UUID,
    body: MeetingReschedule,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if not _is_participant(meeting, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only session participants can reschedule this meeting",
        )

    if meeting.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reschedule a cancelled meeting",
        )

    user_time_zone = body.user_time_zone or "UTC"
    duration = body.duration_minutes or meeting.duration_minutes
    title = body.title or meeting.title
    description = body.description or meeting.description or ""

    if meeting.calendar_event_id:
        updated_link = await _update_meet_calendar(
            event_id=meeting.calendar_event_id,
            title=title,
            description=description,
            start_time=body.start_time,
            duration_minutes=duration,
            user_time_zone=user_time_zone,
        )
        if updated_link:
            meeting.meet_link = updated_link

    meeting.start_time = body.start_time
    meeting.duration_minutes = duration
    meeting.title = title
    if body.description is not None:
        meeting.description = body.description
    meeting.status = "rescheduled"
    db.add(meeting)
    await db.flush()

    other_id = (
        meeting.invitee_id
        if meeting.organizer_id == current_user.id
        else meeting.organizer_id
    )
    await _create_notification(
        db,
        other_id,
        (
            f"{current_user.name} rescheduled the session '{meeting.title}' "
            f"to {body.start_time.strftime('%Y-%m-%d %H:%M UTC')}."
        ),
    )
    await db.flush()

    return _meeting_response(meeting)


@router.get("", response_model=dict)
async def list_meetings(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Meeting)
        .options(
            selectinload(Meeting.organizer),
            selectinload(Meeting.invitee),
        )
        .where(
            or_(
                Meeting.organizer_id == current_user.id,
                Meeting.invitee_id == current_user.id,
            )
        )
        .order_by(Meeting.start_time.asc())
    )
    result = await db.execute(stmt)
    meetings = [MeetingResponse.model_validate(m) for m in result.scalars().all()]
    return {"meetings": meetings}


@router.patch("/{meeting_id}/notes", response_model=dict)
async def update_meeting_notes(
    meeting_id: uuid.UUID,
    body: MeetingNotesUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    meeting = await db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    if not _is_participant(meeting, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only session participants can update notes",
        )

    meeting.notes = body.notes
    db.add(meeting)
    await db.flush()

    return _meeting_response(meeting)
