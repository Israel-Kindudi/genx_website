"""
WebSocket connection manager for broadcasting live updates.

Each connection carries an optional user_id (Seam 3). broadcast(to_user_id=None)
sends to everyone (master events stay public); broadcast(to_user_id=N) sends only
to sockets authenticated as user N (client telemetry is private).
"""

import asyncio
import json
import logging
from typing import Dict, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections and broadcasts messages."""

    def __init__(self):
        self.active: Dict[WebSocket, Optional[int]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None):
        await websocket.accept()
        async with self._lock:
            self.active[websocket] = user_id
        logger.info(f"[ws] Client connected. Total: {len(self.active)} user_id={user_id}")

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active.pop(websocket, None)
        logger.info(f"[ws] Client disconnected. Total: {len(self.active)}")

    async def broadcast(self, message: dict, *, to_user_id: Optional[int] = None):
        """Send a JSON message. to_user_id=None -> all; otherwise only that user."""
        if not self.active:
            return
        payload = json.dumps(message, default=str)
        dead = set()
        async with self._lock:
            for ws, uid in self.active.items():
                if to_user_id is not None and uid != to_user_id:
                    continue
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.warning(f"[ws] Send failed: {e}")
                    dead.add(ws)
            for ws in dead:
                self.active.pop(ws, None)


manager = ConnectionManager()
# --- END FILE ---