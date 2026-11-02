"""
backend/app/main.py — GenX

Single, consolidated FastAPI application.
"""
import json
import logging
import asyncio
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, SessionLocal
from .plans_seed import seed_plans
from .routers import payments_router

# after other include_router calls
# Routers
from .routers import (
    auth_router,
    dna_router,
    strategies_router,
    backtest_router,
    live_router,
    mining_router,
    audit_router,
    bridge_router,
)
from .routers.subscriptions_router import router as subs_router, public_router

# WebSocket + watcher infrastructure
from .websocket_manager import manager
from .file_watcher import watcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Anchored to this file: backend/app/main.py -> parents[1] = backend/
BACKEND_ROOT = Path(__file__).resolve().parents[1]
CLIENT_RESULTS_ROOT = BACKEND_ROOT / "client_results"


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="GenX API",
    version="1.0.0",
    description="Backend API for the GenX quantitative trading platform.",
    redirect_slashes=True,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_origins = (
    settings.allowed_origins_list
    if hasattr(settings, "allowed_origins_list")
    else (settings.allowed_origins if hasattr(settings, "allowed_origins") else ["*"])
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth_router.router)
app.include_router(dna_router.router)
app.include_router(strategies_router.router)
app.include_router(backtest_router.router)
app.include_router(live_router.router)
app.include_router(mining_router.router)
app.include_router(audit_router.router)
app.include_router(subs_router)            # authenticated /api/subscriptions/*
app.include_router(public_router)          # unauthenticated /api/public/plans
app.include_router(payments_router.router)
app.include_router(bridge_router.router)   # /api/bridge/*


# ---------------------------------------------------------------------------
# Snapshot-on-connect
# ---------------------------------------------------------------------------
def _load_client_snapshots():
    """Read currently-known client telemetry snapshots from disk.

    Returns a list of {"bridge_id", "data", "timestamp"} dicts, one per
    performance.json under backend/client_results/*/.
    """
    out = []
    if not CLIENT_RESULTS_ROOT.exists():
        return out
    for path in sorted(CLIENT_RESULTS_ROOT.glob("*/performance.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"[ws] snapshot read failed {path}: {e}")
            continue
        out.append({
            "bridge_id": data.get("bridge_id") or path.parent.name,
            "user_id": data.get("user_id"),
            "data": data,
            "timestamp": data.get("updated_at"),
        })
    return out


def _resolve_user_id_from_token(token: str) -> Optional[int]:
    """Decode a JWT to a users.id, or None. Does not raise to the caller."""
    try:
        from .auth import decode_token
        from .models import User

        payload = decode_token(token)
        email = payload.get("sub")
        if not email:
            return None
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == email).first()
            return user.id if user else None
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"[ws] token decode failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def _startup():
    # 1. Create tables
    Base.metadata.create_all(bind=engine)

    # 2. Seed default plans
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()

    # 3. Start the file watcher
    watcher.start()
    logger.info("✅ GenX API started (watcher running)")


@app.on_event("shutdown")
async def _shutdown():
    await watcher.stop()
    logger.info("🛑 GenX API stopped (watcher halted)")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {"name": "GenX API", "status": "ok", "version": "1.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WebSocket — /ws/live
# ---------------------------------------------------------------------------
@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(None)):
    user_id = _resolve_user_id_from_token(token) if token else None
    if token and user_id is None:
        # A token was supplied and rejected: close, don't silently downgrade.
        await websocket.close(code=1008)
        logger.warning("[ws] rejected connection: invalid token")
        return

    await manager.connect(websocket, user_id=user_id)
    try:
        await websocket.send_json({
            "type": "hello",
            "message": "Connected to GenX live stream",
            "authenticated": user_id is not None,
        })

        # snapshot-on-connect
        # - authenticated: send ONLY this user's bridges' snapshots
        # - anonymous: keep the single-bridge guard (no fan-out)
        snapshots = _load_client_snapshots()
        if user_id is not None:
            mine = [s for s in snapshots if s.get("user_id") == user_id]
            for s in mine:
                await websocket.send_text(json.dumps({
                    "type": "client_equity",
                    "bridge_id": s["bridge_id"],
                    "data": s["data"],
                    "timestamp": s["timestamp"],
                }, default=str))
            logger.info(f"[ws] snapshot-on-connect user_id={user_id} count={len(mine)}")
        else:
            if len(snapshots) == 1:
                s = snapshots[0]
                await websocket.send_text(json.dumps({
                    "type": "client_equity",
                    "bridge_id": s["bridge_id"],
                    "data": s["data"],
                    "timestamp": s["timestamp"],
                }, default=str))
                logger.info(f"[ws] snapshot-on-connect (anon) {s['bridge_id']}")
            elif len(snapshots) > 1:
                logger.warning(
                    f"[ws] {len(snapshots)} bridges present; anonymous "
                    f"snapshot-on-connect disabled (no fan-out)"
                )

        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[ws] Error: {e}")
        await manager.disconnect(websocket)
# --- END FILE ---