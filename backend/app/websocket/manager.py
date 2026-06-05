import json
from typing import Any, Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self.user_connections[user_id] = websocket

    def disconnect(self, user_id: str) -> None:
        self.user_connections.pop(user_id, None)
        for conv_id, sockets in list(self.active_connections.items()):
            self.active_connections[conv_id] = {s for s in sockets if s != self.user_connections.get(user_id)}
            if not self.active_connections[conv_id]:
                del self.active_connections[conv_id]

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

    async def send_to_user(self, user_id: str, message: dict[str, Any]) -> None:
        ws = self.user_connections.get(user_id)
        if ws:
            await ws.send_text(json.dumps(message))


manager = ConnectionManager()
