"use client";

import { useMemo, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useLiveTrades, LiveTrade } from "@/lib/useLiveTrades";

export default function LiveTerminal() {
  const { trades, equityPoints, connected } = useLiveTrades(200, 300);
  const [filter, setFilter] = useState<"ALL" | "BUY" | "SELL" | "OPEN" | "CLOSED">("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LiveTrade | null>(null);

  // Starting equity from first data point, or a default
  const startEquity = useMemo(() => {
    if (equityPoints.length > 0) return equityPoints[0].equity;
    return 100000;
  }, [equityPoints]);

  // Build equity history
  const equityHistory = useMemo(() => {
    if (equityPoints.length === 0) {
      return [
        {
          time: new Date().toLocaleTimeString(),
          equity: startEquity,
          balance: startEquity,
          peak: startEquity,
          drawdown: 0,
        },
      ];
    }

    let peak = equityPoints[0].equity;
    return equityPoints.map((p, i) => {
      if (p.equity > peak) peak = p.equity;
      const drawdown = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0;
      const t = new Date(p.timestamp);
      return {
        time: t.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        equity: p.equity,
        balance: p.balance,
        peak,
        drawdown: Math.round(drawdown * 100) / 100,
        cycle: p.cycle,
        open_positions: p.open_positions,
        _key: `${p.timestamp}-${i}`,
      };
    });
  }, [equityPoints, startEquity]);

  const latest = equityHistory[equityHistory.length - 1];
  const first = equityHistory[0];

  const kpis = useMemo(() => {
    const closed = trades.filter((t) => t.status === "closed");
    const open = trades.filter((t) => t.status === "open");
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
    const realizedPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
    const peakDrawdown = Math.max(...equityHistory.map((h) => h.drawdown || 0), 0);
    const equityChange = latest.equity - first.equity;
    const changePct = first.equity > 0 ? (equityChange / first.equity) * 100 : 0;

    return {
      equity: latest.equity,
      balance: latest.balance,
      realizedPnL,
      winRate,
      peakDrawdown,
      totalTrades: closed.length,
      openCount: open.length,
      equityChange,
      changePct,
      cycle: latest.cycle,
      openPositions: latest.open_positions,
    };
  }, [trades, equityHistory, latest, first]);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (search && !t.symbol.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filter === "BUY") return t.action === "BUY";
      if (filter === "SELL") return t.action === "SELL";
      if (filter === "OPEN") return t.status === "open";
      if (filter === "CLOSED") return t.status === "closed";
      return true;
    });
  }, [trades, filter, search]);

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="border-b border-slate-800/80 bg-[#0e131f]/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-blue-600 p-2 rounded-xl text-slate-950 text-xl">
            🧬
          </div>
          <div>
            <h1 className="font-bold text-lg bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              GENX{" "}
              <span className="text-cyan-400 text-xs px-1.5 py-0.5 border border-cyan-500/30 rounded">
                TERMINAL
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Cycle {kpis.cycle} • {kpis.openPositions} open positions
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            connected
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
          />
          {connected ? "LIVE" : "DISCONNECTED"}
        </div>
      </header>

      {/* KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 bg-[#0c101a] border-b border-slate-800/60">
        <KPI
          label="Total Equity"
          value={`$${kpis.equity.toFixed(2)}`}
          sub={`${kpis.changePct >= 0 ? "+" : ""}${kpis.changePct.toFixed(2)}%`}
          subColor={kpis.changePct >= 0 ? "emerald" : "rose"}
          accent="cyan"
        />
        <KPI
          label="Realized PnL"
          value={`${kpis.realizedPnL >= 0 ? "+" : ""}$${kpis.realizedPnL.toFixed(2)}`}
          accent={kpis.realizedPnL >= 0 ? "emerald" : "rose"}
        />
        <KPI
          label="Win Rate"
          value={`${kpis.winRate.toFixed(1)}%`}
          sub={`${kpis.totalTrades} closed`}
          accent="blue"
        />
        <KPI
          label="Max Drawdown"
          value={`-${kpis.peakDrawdown.toFixed(2)}%`}
          accent="rose"
        />
        <KPI
          label="Balance"
          value={`$${kpis.balance.toFixed(2)}`}
          accent="amber"
        />
        <KPI
          label="Open / Closed"
          value={`${kpis.openCount} / ${kpis.totalTrades}`}
          accent="cyan"
        />
      </div>

      {/* MAIN SPLIT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* EQUITY CHART */}
        <div className="lg:col-span-8 bg-[#111625] border border-slate-800/80 rounded-2xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Real-Time Equity Curve
              </h2>
              <p className="text-xs text-slate-400">
                Mark-to-market equity vs realized balance
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              {equityHistory.length} points
            </div>
          </div>

          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityHistory}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <XAxis
                  dataKey="time"
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  stroke="#475569"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine
                  y={startEquity}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                  label={{
                    value: `Start $${startEquity.toFixed(2)}`,
                    fill: "#94a3b8",
                    fontSize: 10,
                    position: "insideBottomRight",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="peak"
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  fill="url(#peakGrad)"
                  name="High Watermark"
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                  name="Realized Balance"
                />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#06b6d4"
                  strokeWidth={3}
                  fill="url(#equityGrad)"
                  name="Total Equity"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* TRADE FEED */}
        <div className="lg:col-span-4 bg-[#111625] border border-slate-800/80 rounded-2xl flex flex-col min-h-[500px] overflow-hidden">
          <div className="p-3 border-b border-slate-800/80 bg-[#0e131f]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wide">
                Trade Execution Feed
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {filteredTrades.length}
              </span>
            </div>
            <input
              type="text"
              placeholder="Filter symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
            <div className="flex gap-1 mt-2 flex-wrap">
              {(["ALL", "BUY", "SELL", "OPEN", "CLOSED"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                    filter === f
                      ? "bg-slate-700 text-cyan-300 border border-slate-600"
                      : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredTrades.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Waiting for trades from the live engine…
              </div>
            ) : (
              filteredTrades.map((t) => {
                const isOpen = t.status === "open";
                const isProfit = (t.pnl ?? 0) >= 0;
                return (
                  <button
                    key={`${t.ticket}-${t.status}`}
                    onClick={() => setSelected(t)}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-800/80 bg-[#141a29]/80 hover:border-slate-700 hover:bg-[#192133] transition flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          t.action === "BUY"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {t.action}
                      </div>
                      <div>
                        <div className="font-mono font-bold text-xs text-slate-100">
                          {t.symbol}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {t.entry_time
                            ? new Date(t.entry_time).toLocaleTimeString()
                            : "—"}
                          {" • "}
                          {t.strategy.substring(0, 20)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {isOpen ? (
                        <div className="text-[10px] text-amber-400 font-semibold">
                          OPEN
                        </div>
                      ) : (
                        <div
                          className={`font-mono font-bold text-xs ${
                            isProfit ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfit ? "+" : ""}${(t.pnl ?? 0).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selected && <TradeDrawer trade={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function KPI({
  label,
  value,
  sub,
  subColor,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: "emerald" | "rose";
  accent: "cyan" | "emerald" | "rose" | "blue" | "amber";
}) {
  const accents = {
    cyan: "bg-cyan-500/80",
    emerald: "bg-emerald-500/80",
    rose: "bg-rose-500/80",
    blue: "bg-blue-500/80",
    amber: "bg-amber-500/80",
  };
  const subCls =
    subColor === "emerald"
      ? "text-emerald-400"
      : subColor === "rose"
      ? "text-rose-400"
      : "text-slate-400";
  return (
    <div className="bg-[#111625] border border-slate-800/80 rounded-xl p-3 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${accents[accent]}`} />
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-mono font-bold text-white">{value}</div>
      {sub && <div className={`text-[10px] font-mono mt-0.5 ${subCls}`}>{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0e131f]/95 border border-slate-700 rounded-xl p-3 text-xs font-mono shadow-2xl">
      <div className="text-slate-400 mb-2">
        {d.time} • Cycle {d.cycle}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-cyan-400">Equity</span>
          <span className="text-slate-100">${d.equity.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-400">Balance</span>
          <span className="text-slate-200">${d.balance.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-amber-400">Positions</span>
          <span className="text-amber-300">{d.open_positions}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-rose-400">Drawdown</span>
          <span className="text-rose-300">-{d.drawdown}%</span>
        </div>
      </div>
    </div>
  );
}

function TradeDrawer({
  trade,
  onClose,
}: {
  trade: LiveTrade;
  onClose: () => void;
}) {
  const isProfit = (trade.pnl ?? 0) >= 0;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-[#111625] border-l border-slate-800 h-full p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`px-2 py-1 rounded text-xs font-bold ${
                  trade.action === "BUY"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {trade.action}
              </div>
              <div>
                <h3 className="font-bold text-base font-mono">{trade.symbol}</h3>
                <p className="text-xs text-slate-400">Ticket: {trade.ticket}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-100 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <Row label="Strategy" value={trade.strategy} />
            <Row label="Session" value={trade.session_id} />
            <Row label="Entry" value={trade.entry_price?.toFixed(5) ?? "—"} />
            <Row label="Exit" value={trade.exit_price?.toFixed(5) ?? "—"} />
            <Row label="Lot" value={String(trade.lot)} />
            <Row label="SL" value={trade.sl?.toFixed(5) ?? "—"} />
            <Row label="TP" value={trade.tp?.toFixed(5) ?? "—"} />
            {trade.regime && <Row label="Regime" value={trade.regime} />}
            <Row label="Status" value={trade.status.toUpperCase()} />
            <Row
              label="PnL"
              value={
                trade.pnl !== null
                  ? `${isProfit ? "+" : ""}$${trade.pnl.toFixed(2)}`
                  : "Open"
              }
              highlight={isProfit ? "emerald" : "rose"}
            />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "emerald" | "rose";
}) {
  const color =
    highlight === "emerald"
      ? "text-emerald-400"
      : highlight === "rose"
      ? "text-rose-400"
      : "text-slate-200";
  return (
    <div className="flex justify-between py-2 border-b border-slate-800/60">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${color} truncate max-w-[180px]`}>{value}</span>
    </div>
  );
}