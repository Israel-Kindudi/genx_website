import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from .config import settings
from .database import Base, engine
from .routers import (
    auth_router, dna_router, strategies_router,
    backtest_router, live_router, mining_router, audit_router,
)
from .websocket_manager import manager
from .file_watcher import watcher
# ============================================================
# backend/app/main.py — key additions
# ============================================================
from .database import Base, engine, SessionLocal
from .plans_seed import seed_plans
from .routers import subscriptions_router   # add

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GenX API",
    version="1.0.0",
    description="Backend API for the GenX quantitative trading platform.",
    redirect_slashes=True,  # Accept both /path and /path/
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router.router)
app.include_router(dna_router.router)
app.include_router(strategies_router.router)
app.include_router(backtest_router.router)
app.include_router(live_router.router)
app.include_router(mining_router.router)
app.include_router(audit_router.router)

# Register router
app.include_router(subscriptions_router.router)
# ============================================================
# backend/app/main.py  — GenX
# ============================================================
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, SessionLocal
from .plans_seed import seed_plans

# --- routers ---
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

app = FastAPI(title="GenX API", version="1.0.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins if hasattr(settings, "allowed_origins") else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- register routers ---
app.include_router(auth_router.router)
app.include_router(dna_router.router)
app.include_router(strategies_router.router)
app.include_router(backtest_router.router)
app.include_router(live_router.router)
app.include_router(mining_router.router)
app.include_router(audit_router.router)
app.include_router(subs_router)          # ← authenticated subscriptions
app.include_router(public_router)        # ← public plans (no auth)  ⭐ THIS

# --- startup ---
@app.on_event("startup")
def _startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_plans(db)
    finally:
        db.close()

# --- health ---
@app.get("/")
def root():
    return {"status": "ok", "service": "genx-api"}

@app.get("/health")
def health():
    return {"status": "ok"}

# ... your existing websocket + file watcher wiring stays here ...


@app.on_event("shutdown")
async def shutdown_event():
    await watcher.stop()
    logger.info("🛑 Live results watcher stopped")


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
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"[ws] Error: {e}")
        await manager.disconnect(websocket)


@app.get("/")
def root():
    return {"name": "GenX API", "status": "ok", "version": "1.0.0"}

