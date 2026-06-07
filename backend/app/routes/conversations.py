from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.connection import Connection, ConnectionStatus
from app.models.message import Conversation, Message, conversation_participants
from app.models.user import User
from app.schemas.auth import MessageResponse as StatusMessageResponse
from app.schemas.message import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
from app.utils.user_mapper import to_user_public

router = APIRouter(tags=["Messages"])

ATTACHMENT_TYPES = {"file", "image"}


def _last_message_preview(msg: Message) -> str:
    if msg.message_type in ATTACHMENT_TYPES and msg.attachment_meta:
        file_name = msg.attachment_meta.get("file_name") or "Attachment"
        if msg.message_type == "image":
            return f"📷 {file_name}"
        return f"📎 {file_name}"
    return msg.content or ""


def _parse_uploaded_at(meta: dict | None) -> datetime | None:
    if not meta:
        return None
    raw = meta.get("uploaded_at")
    if not raw:
        return None
    if isinstance(raw, datetime):
        return raw
    try:
        return datetime.fromisoformat(str(raw))
    except ValueError:
        return None


def _build_message_response(msg: Message, sender: User | None) -> MessageResponse:
    meta = msg.attachment_meta or {}
    return MessageResponse(
        id=msg.id,
        content=msg.content,
        sender_id=msg.sender_id,
        timestamp=msg.timestamp,
        sender=to_user_public(sender) if sender else None,
        message_type=msg.message_type or "text",
        file_name=meta.get("file_name"),
        file_url=meta.get("file_url"),
        mime_type=meta.get("mime_type"),
        file_size=meta.get("file_size"),
        uploaded_at=_parse_uploaded_at(meta),
        is_read=msg.is_read,
    )


def _message_ws_payload(msg: Message) -> dict:
    meta = msg.attachment_meta or {}
    return {
        "id": str(msg.id),
        "conversation_id": str(msg.conversation_id),
        "sender_id": str(msg.sender_id),
        "content": msg.content,
        "timestamp": msg.timestamp.isoformat(),
        "message_type": msg.message_type or "text",
        "file_name": meta.get("file_name"),
        "file_url": meta.get("file_url"),
        "mime_type": meta.get("mime_type"),
        "file_size": meta.get("file_size"),
        "uploaded_at": meta.get("uploaded_at"),
        "is_read": msg.is_read,
    }


def _build_attachment_meta(body: MessageCreate) -> dict:
    uploaded_at = datetime.now(timezone.utc).isoformat()
    return {
        "file_name": body.file_name,
        "file_url": body.file_url,
        "file_size": body.file_size or 0,
        "mime_type": body.mime_type or "",
        "uploaded_at": uploaded_at,
    }


async def _find_existing_conversation(
    db: AsyncSession, participant_ids: set[UUID]
) -> Conversation | None:
    if len(participant_ids) != 2:
        return None

    shared_conversations = (
        select(conversation_participants.c.conversation_id)
        .where(conversation_participants.c.user_id.in_(participant_ids))
        .group_by(conversation_participants.c.conversation_id)
        .having(func.count(conversation_participants.c.user_id) == 2)
    )

    result = await db.execute(
        select(Conversation)
        .where(Conversation.id.in_(shared_conversations))
        .options(selectinload(Conversation.participants))
    )
    for conv in result.scalars().unique().all():
        conv_participant_ids = {p.id for p in conv.participants}
        if conv_participant_ids == participant_ids:
            return conv
    return None


async def _users_are_connected(db: AsyncSession, user_a: UUID, user_b: UUID) -> bool:
    result = await db.execute(
        select(Connection.id).where(
            Connection.status == ConnectionStatus.accepted,
            or_(
                and_(Connection.sender_id == user_a, Connection.receiver_id == user_b),
                and_(Connection.sender_id == user_b, Connection.receiver_id == user_a),
            ),
        )
    )
    return result.scalar_one_or_none() is not None


async def _require_connected_with_participants(
    db: AsyncSession, current_user: CurrentUser, participant_ids: set[UUID]
) -> None:
    for other_id in participant_ids - {current_user.id}:
        if not await _users_are_connected(db, current_user.id, other_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Connect with this user to start a conversation",
            )


async def _unread_count(db: AsyncSession, conversation_id: UUID, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_read.is_(False),
        )
    )
    return result.scalar() or 0


async def _build_conversation_response(
    db: AsyncSession, conv: Conversation, current_user: CurrentUser
) -> ConversationResponse:
    last_msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(desc(Message.timestamp))
        .limit(1)
    )
    last_msg = last_msg_result.scalar_one_or_none()

    unread = await _unread_count(db, conv.id, current_user.id)
    return ConversationResponse(
        id=conv.id,
        participants=[to_user_public(p) for p in conv.participants],
        last_message=_last_message_preview(last_msg) if last_msg else None,
        last_message_at=last_msg.timestamp if last_msg else None,
        unread=unread,
    )


@router.get("/conversations", response_model=dict)
async def list_conversations(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Conversation)
        .join(conversation_participants)
        .where(conversation_participants.c.user_id == current_user.id)
        .options(selectinload(Conversation.participants))
        .order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().unique().all()
    items: list[ConversationResponse] = []

    for conv in conversations:
        items.append(await _build_conversation_response(db, conv, current_user))

    items.sort(
        key=lambda item: (
            -item.unread,
            -(item.last_message_at.timestamp() if item.last_message_at else 0),
        )
    )

    return {"conversations": items}


@router.post("/conversations", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    body: ConversationCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    participant_ids = set(body.participant_ids) | {current_user.id}
    if len(participant_ids) < 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Need at least one other participant")

    await _require_connected_with_participants(db, current_user, participant_ids)

    existing = await _find_existing_conversation(db, participant_ids)
    if existing:
        item = await _build_conversation_response(db, existing, current_user)
        return {"conversation": item}

    users_result = await db.execute(select(User).where(User.id.in_(participant_ids)))
    users = users_result.scalars().all()
    if len(users) != len(participant_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more users not found")

    conv = Conversation(participants=users)
    db.add(conv)
    await db.flush()

    return {
        "conversation": ConversationResponse(
            id=conv.id,
            participants=[to_user_public(u) for u in users],
            unread=0,
        )
    }


@router.get("/conversations/{conversation_id}", response_model=dict)
async def get_conversation(
    conversation_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    item = await _build_conversation_response(db, conv, current_user)
    return {"conversation": item}


@router.delete("/conversations/{conversation_id}", response_model=StatusMessageResponse)
async def delete_conversation(
    conversation_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    await db.delete(conv)
    return StatusMessageResponse(message="Conversation deleted")


@router.get("/conversations/{conversation_id}/messages", response_model=dict)
async def get_messages(
    conversation_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.timestamp.asc())
    )
    messages = result.scalars().all()
    sender_map = {current_user.id: current_user}
    responses = []
    marked_read_ids: list[str] = []
    notify_sender_ids: set[UUID] = set()
    for msg in messages:
        if msg.sender_id != current_user.id and not msg.is_read:
            msg.is_read = True
            marked_read_ids.append(str(msg.id))
            notify_sender_ids.add(msg.sender_id)

        sender = sender_map.get(msg.sender_id)
        if not sender:
            u = await db.get(User, msg.sender_id)
            sender_map[msg.sender_id] = u
            sender = u
        responses.append(_build_message_response(msg, sender))

    if marked_read_ids:
        await db.flush()
        from app.websocket.manager import manager

        read_payload = {
            "type": "read",
            "data": {
                "conversation_id": str(conv.id),
                "message_ids": marked_read_ids,
            },
        }
        await manager.broadcast_to_conversation(str(conv.id), read_payload)
        for sender_id in notify_sender_ids:
            await manager.send_to_user(str(sender_id), read_payload)
    else:
        await db.flush()
    return {"messages": responses}


@router.post("/conversations/{conversation_id}/messages", response_model=dict, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: UUID,
    body: MessageCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    for participant in conv.participants:
        if participant.id != current_user.id:
            if not await _users_are_connected(db, current_user.id, participant.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Connect with this user to start a conversation",
                )

    message_type = (body.message_type or "text").lower()
    attachment_meta = None
    content = body.content.strip()

    if message_type in ATTACHMENT_TYPES:
        if not body.file_url or not body.file_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="file_url and file_name are required for attachment messages",
            )
        attachment_meta = _build_attachment_meta(body)
        if not content:
            content = body.file_name
        if message_type == "image" or (body.mime_type or "").startswith("image/"):
            message_type = "image"
        else:
            message_type = "file"
    elif not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message content is required")

    message = Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=content,
        message_type=message_type,
        attachment_meta=attachment_meta,
        timestamp=datetime.now(timezone.utc),
        is_read=False,
    )
    conv.updated_at = datetime.now(timezone.utc)
    db.add(message)
    await db.flush()

    from app.websocket.manager import manager

    payload = {"type": "message", "data": _message_ws_payload(message)}
    await manager.broadcast_to_conversation(str(conv.id), payload)

    conv_with_participants = await db.execute(
        select(Conversation)
        .where(Conversation.id == conv.id)
        .options(selectinload(Conversation.participants))
    )
    loaded_conv = conv_with_participants.scalar_one()
    for participant in loaded_conv.participants:
        if participant.id != current_user.id:
            await manager.send_to_user(str(participant.id), payload)

    return {"message": _build_message_response(message, current_user)}


async def _get_user_conversation(conversation_id: UUID, user_id: UUID, db: AsyncSession) -> Conversation:
    result = await db.execute(
        select(Conversation)
        .join(conversation_participants)
        .where(
            and_(
                Conversation.id == conversation_id,
                conversation_participants.c.user_id == user_id,
            )
        )
        .options(selectinload(Conversation.participants))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv
