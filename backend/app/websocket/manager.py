import json
from datetime import datetime, timezone
from typing import Any, Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        self.presence_connections: Dict[str, WebSocket] = {}
        self.last_heartbeat: Dict[str, datetime] = {}

    async def connect_message(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)

    async def connect_presence(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self.presence_connections[user_id] = websocket
        self.last_heartbeat[user_id] = datetime.now(timezone.utc)
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        sockets = self.user_connections.get(user_id)
        if sockets:
            sockets.discard(websocket)
            if not sockets:
                del self.user_connections[user_id]

        if self.presence_connections.get(user_id) == websocket:
            del self.presence_connections[user_id]
            self.last_heartbeat.pop(user_id, None)

        for conv_id, conv_sockets in list(self.active_connections.items()):
            conv_sockets.discard(websocket)
            if not conv_sockets:
                del self.active_connections[conv_id]

    def touch_heartbeat(self, user_id: str) -> None:
        self.last_heartbeat[user_id] = datetime.now(timezone.utc)

    def get_stale_presence_users(self, timeout_seconds: int) -> list[str]:
        now = datetime.now(timezone.utc)
        stale: list[str] = []
        for user_id, last_seen in self.last_heartbeat.items():
            if user_id not in self.presence_connections:
                continue
            if (now - last_seen).total_seconds() > timeout_seconds:
                stale.append(user_id)
        return stale

    async def subscribe_conversation(self, websocket: WebSocket, conversation_id: str) -> None:
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = set()
        self.active_connections[conversation_id].add(websocket)

    def unsubscribe_conversation(self, websocket: WebSocket, conversation_id: str) -> None:
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].discard(websocket)

    async def broadcast_to_conversation(self, conversation_id: str, message: dict[str, Any]) -> None:
        payload = json.dumps(message)
        for ws in self.active_connections.get(conversation_id, set()):
            await ws.send_text(payload)

    async def broadcast_presence(
        self, user_id: str, is_online: bool, last_seen_at: str | None
    ) -> None:
        payload = json.dumps(
            {
                "type": "presence_update",
                "data": {
                    "user_id": user_id,
                    "is_online": is_online,
                    "last_seen_at": last_seen_at,
                },
            }
        )
        seen: set[int] = set()
        for sockets in self.user_connections.values():
            for ws in sockets:
                ws_id = id(ws)
                if ws_id in seen:
                    continue
                seen.add(ws_id)
                try:
                    await ws.send_text(payload)
                except Exception:
                    pass

    async def send_to_user(self, user_id: str, message: dict[str, Any]) -> None:
        payload = json.dumps(message)
        for ws in self.user_connections.get(user_id, set()):
            try:
                await ws.send_text(payload)
            except Exception:
                pass


manager = ConnectionManager()
