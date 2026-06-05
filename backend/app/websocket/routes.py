from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy import and_, select

from app.core.security import decode_token
from app.database import AsyncSessionLocal
from app.models.message import Conversation, conversation_participants
from app.models.user import User
from app.websocket.manager import manager

router = APIRouter()


async def _authenticate_ws(token: str) -> User | None:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        return None
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == UUID(payload["sub"])))
        return result.scalar_one_or_none()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    conversation_id: str | None = Query(None),
):
    user = await _authenticate_ws(token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket, str(user.id))

    if conversation_id:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Conversation)
                .join(conversation_participants)
                .where(
                    and_(
                        Conversation.id == UUID(conversation_id),
                        conversation_participants.c.user_id == user.id,
                    )
                )
            )
            if not result.scalar_one_or_none():
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        await manager.subscribe_conversation(websocket, conversation_id)

    try:
        await websocket.send_json({"type": "connected", "user_id": str(user.id)})
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "ack", "received": data})
    except WebSocketDisconnect:
        manager.disconnect(str(user.id))
        if conversation_id:
            manager.unsubscribe_conversation(websocket, conversation_id)
