from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import CurrentUser
from app.models.message import Conversation, Message, conversation_participants
from app.models.user import User
from app.schemas.message import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
from app.utils.user_mapper import to_user_public

router = APIRouter(tags=["Messages"])


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
        last_msg_result = await db.execute(
            select(Message).where(Message.conversation_id == conv.id).order_by(desc(Message.timestamp)).limit(1)
        )
        last_msg = last_msg_result.scalar_one_or_none()
        items.append(
            ConversationResponse(
                id=conv.id,
                participants=[to_user_public(p) for p in conv.participants],
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.timestamp if last_msg else conv.updated_at,
                unread=0,
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
    for msg in messages:
        sender = sender_map.get(msg.sender_id)
        if not sender:
            u = await db.get(User, msg.sender_id)
            sender_map[msg.sender_id] = u
            sender = u
        responses.append(
            MessageResponse(
                id=msg.id,
                content=msg.content,
                sender_id=msg.sender_id,
                timestamp=msg.timestamp,
                sender=to_user_public(sender) if sender else None,
            )
        )
    return {"messages": responses}


@router.post("/conversations/{conversation_id}/messages", response_model=dict, status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: UUID,
    body: MessageCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    conv = await _get_user_conversation(conversation_id, current_user.id, db)
    message = Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=body.content,
        timestamp=datetime.now(timezone.utc),
    )
    conv.updated_at = datetime.now(timezone.utc)
    db.add(message)
    await db.flush()

    from app.websocket.manager import manager

    await manager.broadcast_to_conversation(
        str(conv.id),
        {
            "type": "message",
            "data": {
                "id": str(message.id),
                "conversation_id": str(conv.id),
                "sender_id": str(current_user.id),
                "content": message.content,
                "timestamp": message.timestamp.isoformat(),
            },
        },
    )

    return {
        "message": MessageResponse(
            id=message.id,
            content=message.content,
            sender_id=message.sender_id,
            timestamp=message.timestamp,
            sender=to_user_public(current_user),
        )
    }


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
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv
