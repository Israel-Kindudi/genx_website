"""
backend/app/main.py — GenX

Single, consolidated FastAPI application.
"""
import logging
import asyncio

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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
)
from .routers.subscriptions_router import router as subs_router, public_router

# WebSocket + watcher infrastructure
from .websocket_manager import manager
from .file_watcher import watcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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

    # 3. Start the file watcher (THE MISSING PIECE)
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
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "hello",
            "message": "Connected to GenX live stream",
        })
        while True:
            try:
                # Consume client messages; sends heartbeat on idle
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[ws] Error: {e}")
        await manager.disconnect(websocket)