"use client";

import { useEffect, useRef, useState } from "react";

export type MasterPoint = { timestamp: string; equity: number; balance?: number | null };

export type MasterSummary = {
  equity: number;
  balance: number | null;
  cycle: number;
  open_positions: number;
  timestamp: string;
  initial_capital: number;
  account_currency: string;
  pnl_today: number;
  pnl_total: number;
  win_rate: number | null;
  trades_closed: number;
};

type Status = "loading" | "ready" | "empty";

const MAX_POINTS = 400;

// Public data only: the master stream is broadcast to anonymous sockets.
export function useMasterEquity() {
  const isDemo =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ACCOUNT_DATA_PROVIDER !== "live";
  const [points, setPoints] = useState<MasterPoint[]>([]);
  const [summary, setSummary] = useState<MasterSummary | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [connected, setConnected] = useState(false);
  const summaryRef = useRef<MasterSummary | null>(null);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  // Development preview: simulated account, mirrors the dashboard demo provider.
  useEffect(() => {
    if (!isDemo || typeof window === "undefined") return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    import("@/lib/masterEquityDemo").then(({ createMasterDemo }) => {
      if (cancelled) return;
      const demo = createMasterDemo();
      setPoints(demo.initial.points);
      setSummary(demo.initial.summary);
      setStatus("ready");
      setConnected(true);
      timer = setInterval(() => {
        const { point, summary: next } = demo.tick();
        setPoints((prev) => {
          const last = prev[prev.length - 1];
          const sameDay = last && last.timestamp.slice(0, 10) === point.timestamp.slice(0, 10);
          return (sameDay ? [...prev.slice(0, -1), point] : [...prev, point]).slice(-MAX_POINTS);
        });
        setSummary(next);
      }, 1500);
    });
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [isDemo]);

  useEffect(() => {
    if (isDemo || typeof window === "undefined") return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let shouldReconnect = true;
    let hasConnected = false;
    let ws: WebSocket | null = null;
    let pending: { point: MasterPoint; data: any } | null = null;

    const httpBase =
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      "http://localhost:8000";
    const wsBase = process.env.NEXT_PUBLIC_API_BASE || httpBase;
    const wsUrl = wsBase.replace(/^http/, "ws") + "/ws/live";

    async function loadHistory() {
      try {
        const res = await fetch(`${httpBase}/api/public/master/equity`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (cancelled) return;
        if (json?.available && Array.isArray(json.points) && json.summary) {
          setPoints(json.points);
          setSummary(json.summary);
          setStatus("ready");
        } else {
          setStatus((s) => (s === "ready" ? s : "empty"));
        }
      } catch {
        if (!cancelled) setStatus((s) => (s === "ready" ? s : "empty"));
      }
    }

    function flush() {
      flushTimer = undefined;
      const p = pending;
      pending = null;
      if (!p || cancelled) return;
      const { point, data } = p;
      point.balance = typeof data.balance === "number" ? data.balance : null;
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        const sameDay =
          last && last.timestamp.slice(0, 10) === point.timestamp.slice(0, 10);
        const next = sameDay ? [...prev.slice(0, -1), point] : [...prev, point];
        return next.slice(-MAX_POINTS);
      });
      setSummary((prev) => {
        const initial =
          Number(data.initial_capital ?? data.initialCapital) ||
          prev?.initial_capital ||
          point.equity;
        return {
          equity: point.equity,
          balance: typeof data.balance === "number" ? data.balance : prev?.balance ?? null,
          cycle: Number(data.cycle) || prev?.cycle || 0,
          open_positions: Number.isFinite(Number(data.open_positions))
            ? Number(data.open_positions)
            : prev?.open_positions ?? 0,
          timestamp: point.timestamp,
          initial_capital: initial,
          account_currency:
            data.account_currency ?? data.currency ?? prev?.account_currency ?? "USD",
          pnl_today: prev ? prev.pnl_today + (point.equity - prev.equity) : 0,
          pnl_total: point.equity - initial,
          win_rate: prev?.win_rate ?? null,
          trades_closed: prev?.trades_closed ?? 0,
        };
      });
      setStatus("ready");
    }

    function connect() {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        setConnected(true);
        // Catch up on anything missed while disconnected.
        if (hasConnected) loadHistory();
        hasConnected = true;
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== "equity" && msg.type !== "master_equity") return;
          const d = msg.data || {};
          const equity = Number(d.equity);
          if (!Number.isFinite(equity)) return;
          pending = {
            point: {
              timestamp: msg.timestamp ?? d.timestamp ?? new Date().toISOString(),
              equity,
            },
            data: d,
          };
          if (flushTimer === undefined) flushTimer = setTimeout(flush, 500);
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        setConnected(false);
        // Freeze, not clear: last known data stays on screen.
        if (shouldReconnect) reconnectTimer = setTimeout(connect, 3000);
      };
    }

    loadHistory();
    connect();

    return () => {
      cancelled = true;
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (flushTimer) clearTimeout(flushTimer);
      ws?.close();
    };
  }, []);

  return { points, summary, status, connected, isDemo };
}
