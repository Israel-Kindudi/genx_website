"use client";

import { useEffect, useRef, useState } from "react";

export type LiveTrade = {
  ticket: number;
  session_id: string;
  strategy: string;
  symbol: string;
  action: string;
  entry_price: number | null;
  exit_price: number | null;
  lot: number;
  sl: number | null;
  tp: number | null;
  pnl: number | null;
  status: "open" | "closed";
  entry_time: string | null;
  exit_time: string | null;
  regime?: string;
};

export type LiveEquity = {
  session_id: string;
  equity: number;
  balance: number;
  open_positions: number;
  cycle: number;
  timestamp: string;
};

export function useLiveTrades(maxTrades = 200, maxEquityPoints = 300) {
  const [trades, setTrades] = useState<LiveTrade[]>([]);
  const [equityPoints, setEquityPoints] = useState<LiveEquity[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const API_BASE =
      process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
    const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws/live";

    let reconnectTimer: any;
    let shouldReconnect = true;

    function connect() {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log("[ws] connected");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "trade_open") {
            const d = msg.data;
            const trade: LiveTrade = {
              ticket: d.ticket,
              session_id: msg.session_id,
              strategy: d.strategy || "",
              symbol: d.symbol || "",
              action: d.action || "",
              entry_price: d.entry_price ?? null,
              exit_price: null,
              lot: d.lot ?? 0,
              sl: d.sl ?? null,
              tp: d.tp ?? null,
              pnl: null,
              status: "open",
              entry_time: msg.timestamp ?? null,
              exit_time: null,
              regime: d.regime,
            };
            setTrades((prev) => {
              const updated = [trade, ...prev];
              return updated.slice(0, maxTrades);
            });
          } else if (msg.type === "trade_close") {
            const d = msg.data;
            // Find the open trade and mark it closed
            setTrades((prev) =>
              prev.map((t) =>
                t.ticket === d.ticket
                  ? {
                      ...t,
                      exit_price: d.exit_price ?? null,
                      pnl: d.pnl ?? 0,
                      status: "closed",
                      exit_time: msg.timestamp ?? null,
                    }
                  : t
              )
            );
          } else if (msg.type === "equity") {
            const d = msg.data;
            const point: LiveEquity = {
              session_id: msg.session_id,
              equity: d.equity ?? 0,
              balance: d.balance ?? 0,
              open_positions: d.open_positions ?? 0,
              cycle: d.cycle ?? 0,
              timestamp: msg.timestamp ?? new Date().toISOString(),
            };
            setEquityPoints((prev) => {
              const updated = [...prev, point];
              return updated.length > maxEquityPoints
                ? updated.slice(-maxEquityPoints)
                : updated;
            });
          }
        } catch (e) {
          console.warn("[ws] parse error:", e);
        }
      };

      ws.onerror = () => console.warn("[ws] error");
      ws.onclose = () => {
        console.log("[ws] closed");
        setConnected(false);
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [maxTrades, maxEquityPoints]);

  return { trades, equityPoints, connected };
}