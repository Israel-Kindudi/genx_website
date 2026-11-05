"use client";

import { useId, useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSharedMasterEquity } from "@/lib/MasterEquityContext";

function money(value: number, currency: string, digits = 2) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

function signed(value: number, currency: string) {
  return `${value >= 0 ? "+" : "−"}${money(Math.abs(value), currency)}`;
}

function Kpi({
  label,
  value,
  tone,
  sub,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  sub?: string;
}) {
  const color =
    tone === "pos" ? "text-emerald-400" : tone === "neg" ? "text-rose-400" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0b0f17]/60 px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</div>
            {sub !== undefined && (
              <div className="mt-0.5 text-xs tabular-nums text-slate-500">{sub}</div>
            )}
          </div>
  );
}

export default function MasterEquityCard() {
  const { points, summary, connected, isDemo } = useSharedMasterEquity();
  const gradientId = useId().replace(/:/g, "");
  const [showBalance, setShowBalance] = useState(true);

  const data = useMemo(() => {
    if (points.length > 0) {
      return points.map((p) => ({
        t: new Date(p.timestamp).getTime(),
        equity: p.equity,
        balance: typeof p.balance === "number" ? p.balance : null,
      }));
    }
    const end = Date.now();
    const day = 86_400_000;
    return Array.from({ length: 30 }, (_, i) => ({
      t: end - (29 - i) * day,
      equity: 1,
      balance: null as number | null,
    }));
  }, [points]);

  const hasBalance = useMemo(
    () => points.length > 0 && data.some((d) => d.balance !== null),
    [points, data]
  );
  const balanceVisible = showBalance && hasBalance;

  const domain = useMemo<[number, number]>(() => {
    if (points.length === 0) return [0, 2];
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
      const values = balanceVisible && d.balance !== null ? [d.equity, d.balance] : [d.equity];
      for (const v of values) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    const pad = Math.max((hi - lo) * 0.15, hi * 0.001, 1);
    return [lo - pad, hi + pad];
  }, [data, points.length, balanceVisible]);

  const currency = summary?.account_currency ?? "USD";
  const positive = (summary?.pnl_total ?? 0) >= 0;
  const stroke = positive ? "#10b981" : "#f43f5e";

  return (
    <section className="overflow-x-clip px-6 pb-8 pt-16 md:pt-20" aria-labelledby="master-equity-title">
      <div className="mx-auto max-w-6xl">
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 -bottom-6 h-16 rounded-full bg-emerald-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-10 top-10 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 bottom-16 h-64 w-64 rounded-full bg-sky-500/15 blur-3xl"
          />
          <div
            className="relative overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-[#161f2e]/50 to-[#0b0f17]/50 p-6 backdrop-blur-2xl backdrop-saturate-150 transition-transform duration-500 ease-out hover:-translate-y-1 md:p-8"
            style={{
              boxShadow:
                "0 1px 0 0 rgb(255 255 255 / 18%) inset, 0 0 0 1px rgb(255 255 255 / 4%) inset, 0 24px 40px -16px rgb(0 0 0 / 55%), 0 60px 90px -30px rgb(0 0 0 / 65%)",
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
            />

            <div className="relative mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#10B981]">
                  {isDemo ? "Development preview · simulated data" : "Vortech Markets Live"}
                </span>
                <h2 id="master-equity-title" className="mt-1 text-2xl font-bold md:text-3xl">
                  Master Account
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${
                  connected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {connected && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${
                      connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                    }`}
                  />
                </span>
                {connected ? "LIVE" : "Reconnecting"}
              </span>
            </div>

            <div className="relative min-h-[540px]">
              <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <Kpi
                      label="Equity"
                      value={summary ? money(summary.equity, currency) : "—"}
                      sub={
                        summary && summary.balance !== null
                          ? `Balance ${money(summary.balance, currency)}`
                          : "Balance —"
                      }
                    />
                    <Kpi
                      label="PnL today"
                      value={summary ? signed(summary.pnl_today, currency) : "—"}
                      tone={summary ? (summary.pnl_today >= 0 ? "pos" : "neg") : undefined}
                    />
                    <Kpi
                      label="PnL all-time"
                      value={summary ? signed(summary.pnl_total, currency) : "—"}
                      tone={summary ? (summary.pnl_total >= 0 ? "pos" : "neg") : undefined}
                    />
                    <Kpi label="Cycles" value={summary ? summary.cycle.toLocaleString("en-US") : "—"} />
                    <Kpi
                      label="Win rate"
                      value={
                        summary && summary.win_rate !== null
                          ? `${summary.win_rate.toFixed(1)}%`
                          : "—"
                      }
                    />
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="h-0.5 w-4 rounded" style={{ background: stroke }} />
                      Equity
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBalance((v) => !v)}
                      disabled={!hasBalance}
                      aria-pressed={balanceVisible}
                      className={`flex items-center gap-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        balanceVisible ? "text-slate-300" : "text-slate-600 line-through"
                      }`}
                    >
                      <span
                        className="w-4 border-t-2 border-dashed"
                        style={{ borderColor: "#64748b" }}
                      />
                      Balance
                    </button>
                  </div>

                  <div className="mt-2 h-[380px] w-full md:h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={stroke} stopOpacity={0.45} />
                            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="t"
                          type="number"
                          scale="time"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(t) =>
                            new Date(t).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          }
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={48}
                          padding={{ left: 16, right: 24 }}
                        />
                        <YAxis
                          domain={domain}
                          orientation="right"
                          width={64}
                          tickFormatter={(v) => (summary ? money(v, currency, 0) : "")}
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          active={summary ? undefined : false}
                          cursor={{ stroke: "#334155", strokeDasharray: "4 4" }}
                          contentStyle={{
                            background: "rgba(11,15,23,0.95)",
                            border: "1px solid #1e293b",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "#94a3b8" }}
                          labelFormatter={(t) => new Date(t as number).toLocaleString("en-US")}
                          formatter={(v: number, name: string) => [
                            money(v, currency),
                            name === "balance" ? "Balance" : "Equity",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="equity"
                          stroke={stroke}
                          strokeWidth={2.5}
                          fill={`url(#${gradientId})`}
                          dot={false}
                          activeDot={{ r: 5, strokeWidth: 0, fill: stroke }}
                          isAnimationActive={false}
                        />
                        {balanceVisible && (
                          <Line
                            type="monotone"
                            dataKey="balance"
                            stroke="#64748b"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            strokeOpacity={1}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0, fill: "#64748b" }}
                            connectNulls
                            isAnimationActive={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Last 30 days · daily snapshots · updated{" "}
                    {summary ? new Date(summary.timestamp).toLocaleString("en-US") : "—"}
                  </p>
              </>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
