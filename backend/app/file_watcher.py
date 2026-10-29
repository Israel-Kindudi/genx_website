"""
Watch live_results/ for events and broadcast trade/equity updates.
Reads directly from events.jsonl (the engine's real-time stream).
"""

import os
import json
import asyncio
import logging
from pathlib import Path

from .config import settings
from .websocket_manager import manager

logger = logging.getLogger(__name__)


class LiveResultsWatcher:
    """Polls events.jsonl files and broadcasts new events."""

    def __init__(self, interval: float = 1.0):
        self.interval = interval
        self.running = False
        self._task = None
        self._offsets = {}

    def _find_event_files(self):
        root = Path(settings.genx_root)
        base = root / "live_results"
        if not base.exists():
            return []
        return list(base.glob("session_*/events.jsonl"))

    def _read_new_events(self, path: Path):
        key = str(path)
        last_offset = self._offsets.get(key, 0)

        try:
            file_size = path.stat().st_size
        except Exception:
            return []

        if file_size < last_offset:
            last_offset = 0

        events = []
        try:
            with open(path, "r", encoding="utf-8") as f:
                f.seek(last_offset)
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        events.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
                self._offsets[key] = f.tell()
        except Exception as e:
            logger.error(f"[watcher] Error reading {path}: {e}")
            return []

        return events

    def _extract_session_id(self, path: Path) -> str:
        for part in path.parts:
            if part.startswith("session_"):
                return part
        return "unknown"

    async def _loop(self):
        logger.info(f"[watcher] Starting events watcher (interval={self.interval}s)")

        while self.running:
            try:
                await asyncio.sleep(self.interval)
                event_files = self._find_event_files()

                for path in event_files:
                    session_id = self._extract_session_id(path)
                    events = self._read_new_events(path)

                    for event in events:
                        event_type = event.get("type")
                        data = event.get("data", {}) or {}

                        if event_type == "equity":
                            # Normalize field aliases the frontend accepts
                            if "initial_capital" not in data and "initialCapital" in data:
                                data["initial_capital"] = data["initialCapital"]
                            if "account_currency" not in data and "currency" in data:
                                data["account_currency"] = data["currency"]

                        if event_type in (
                            "trade_open",
                            "trade_close",
                            "equity",
                            "capital_flow",
                        ):
                            await manager.broadcast({
                                "type": event_type,
                                "session_id": session_id,
                                "data": data,
                                "timestamp": event.get("timestamp"),
                            })

            except Exception as e:
                logger.error(f"[watcher] Error: {e}")
                await asyncio.sleep(self.interval)

    def start(self):
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass


watcher = LiveResultsWatcher()