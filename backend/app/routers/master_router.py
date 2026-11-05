"""
Public master account performance (no auth, read-only).

Source of truth: backend/live_results/session_*/events.jsonl, the same
master stream broadcast by the file watcher over /ws/live.
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public/master", tags=["public"])

MASTER_ROOT = Path(__file__).resolve().parents[2] / "live_results"
WINDOW_DAYS = 30

# (path -> (mtime, size, parsed)) so unchanged files are never re-parsed
_cache: Dict[str, tuple] = {}


def _parse_ts(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _num(value: Any) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return f if f == f and abs(f) != float("inf") else None


def _read_session(path: Path) -> Dict[str, list]:
    """Return {"equity": [...], "closes": [...]} parsed from one events.jsonl."""
    try:
        st = path.stat()
    except OSError:
        return {"equity": [], "closes": []}
    key = str(path)
    hit = _cache.get(key)
    if hit and hit[0] == st.st_mtime and hit[1] == st.st_size:
        return hit[2]

    equity: list = []
    closes: list = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ts = _parse_ts(ev.get("timestamp"))
                data = ev.get("data") or {}
                if ts is None or not isinstance(data, dict):
                    continue
                kind = ev.get("type")
                if kind == "equity":
                    eq = _num(data.get("equity"))
                    if eq is None:
                        continue
                    equity.append({
                        "ts": ts,
                        "equity": eq,
                        "balance": _num(data.get("balance")),
                        "cycle": int(_num(data.get("cycle")) or 0),
                        "open_positions": int(_num(data.get("open_positions")) or 0),
                        "initial_capital": _num(
                            data.get("initial_capital", data.get("initialCapital"))
                        ),
                        "currency": data.get("account_currency") or data.get("currency"),
                    })
                elif kind == "trade_close":
                    pnl = _num(data.get("pnl"))
                    if pnl is not None:
                        closes.append({"ts": ts, "pnl": pnl})
    except Exception as e:
        logger.error(f"[master] failed reading {path}: {e}")
        return {"equity": [], "closes": []}

    parsed = {"equity": equity, "closes": closes}
    _cache[key] = (st.st_mtime, st.st_size, parsed)
    return parsed


def build_master_equity() -> Dict[str, Any]:
    equity: list = []
    closes: list = []
    if MASTER_ROOT.exists():
        for path in MASTER_ROOT.glob("session_*/events.jsonl"):
            s = _read_session(path)
            equity.extend(s["equity"])
            closes.extend(s["closes"])

    if not equity:
        return {"available": False, "points": [], "summary": None}

    equity.sort(key=lambda p: p["ts"])
    latest = equity[-1]
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=WINDOW_DAYS)

    # last snapshot of each day inside the window
    daily: Dict[str, dict] = {}
    for p in equity:
        if p["ts"] >= cutoff:
            daily[p["ts"].date().isoformat()] = p
    points = [
        {
            "timestamp": p["ts"].isoformat(),
            "equity": round(p["equity"], 2),
            "balance": round(p["balance"], 2) if p["balance"] is not None else None,
        }
        for p in daily.values()
    ]
    # make sure the chart ends on the true latest value
    if not points or points[-1]["timestamp"] != latest["ts"].isoformat():
        points.append({
            "timestamp": latest["ts"].isoformat(),
            "equity": round(latest["equity"], 2),
            "balance": round(latest["balance"], 2) if latest["balance"] is not None else None,
        })

    initial = next(
        (p["initial_capital"] for p in equity if p["initial_capital"]), None
    )
    if initial is None:
        initial = equity[0]["equity"]
    currency = next(
        (p["currency"] for p in reversed(equity) if p["currency"]), "USD"
    )

    today = now.date()
    day_start = next(
        (p["equity"] for p in equity if p["ts"].date() == today), None
    )
    prev = [p for p in equity if p["ts"].date() < today]
    day_ref = prev[-1]["equity"] if prev else day_start
    pnl_today = latest["equity"] - day_ref if day_ref is not None else 0.0

    wins = sum(1 for c in closes if c["pnl"] > 0)
    win_rate = (wins / len(closes) * 100.0) if closes else None

    return {
        "available": True,
        "points": points,
        "summary": {
            "equity": round(latest["equity"], 2),
            "balance": latest["balance"],
            "cycle": latest["cycle"],
            "open_positions": latest["open_positions"],
            "timestamp": latest["ts"].isoformat(),
            "initial_capital": round(initial, 2),
            "account_currency": currency,
            "pnl_today": round(pnl_today, 2),
            "pnl_total": round(latest["equity"] - initial, 2),
            "win_rate": round(win_rate, 1) if win_rate is not None else None,
            "trades_closed": len(closes),
        },
    }


@router.get("/equity")
def master_equity():
    return build_master_equity()
