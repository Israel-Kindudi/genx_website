"use client";

import { useSharedMasterEquity } from "@/lib/MasterEquityContext";
import { useVtgxQuote } from "@/lib/useVtgxQuote";
import { TOKEN_CONFIG } from "@/lib/tokenConfig";
import TokenLogo from "@/components/TokenLogo";

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

function LiveDot({ live }: { live: boolean }) {
  return (
    <span
      className={`genx-hero-readout-dot ${live ? "is-live" : "is-idle"}`}
      aria-hidden="true"
    />
  );
}

// Master account only: public master stream, never client data.
export function MasterReadout() {
  const { summary, connected } = useSharedMasterEquity();
  const currency = summary?.account_currency ?? "USD";
  // Performance = today's change versus the start-of-day equity.
  const startOfDay = summary ? summary.equity - summary.pnl_today : 0;
  const hasPerf = !!summary && startOfDay > 0;
  const up = (summary?.pnl_today ?? 0) >= 0;
  const tone = up ? "is-up" : "is-down";
  const pct = hasPerf ? (summary.pnl_today / startOfDay) * 100 : null;
  return (
    <div className="genx-hero-readout genx-hero-readout-top" aria-hidden="true">
      <LiveDot live={connected} />
      <span className="genx-hero-readout-label">MASTER EQUITY</span>
      <span className="genx-hero-readout-value genx-hero-readout-figure">
        {summary ? money(summary.equity, currency) : "—"}
      </span>
      {pct !== null && (
        <span className="genx-hero-readout-sub">
          <span className={tone}>{`${up ? "▲ +" : "▼ "}${pct.toFixed(2)}%`}</span>
          {" · 24H"}
        </span>
      )}
      <span className="genx-hero-readout-sub">
        BALANCE {summary && summary.balance !== null ? money(summary.balance, currency) : "—"}
        {" · "}
        {summary ? summary.open_positions : "—"} OPEN
      </span>
    </div>
  );
}

export function VtgxReadout() {
  // Same rule as the master equity demo: simulated only while developing.
  const isDemo =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_MARKET_DATA_PROVIDER !== "real";
  const { price, change, preLaunch } = useVtgxQuote(isDemo);
  const up = (change?.percent ?? 0) >= 0;
  return (
    <div className="genx-hero-readout genx-hero-readout-bottom" aria-hidden="true">
      <span className="genx-hero-readout-label" style={{ display: "inline-flex", alignItems: "center", gap: "0.4em" }}>
        <TokenLogo size="xs" />
        {TOKEN_CONFIG.ticker} / {TOKEN_CONFIG.quote}
      </span>
      {price !== null ? (
        <>
          <span className="genx-hero-readout-value genx-hero-readout-figure">
            {price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </span>
          <span className="genx-hero-readout-sub">
            {change ? (
              <>
                <span className={up ? "is-up" : "is-down"}>
                  {`${up ? "▲ +" : "▼ "}${change.percent.toFixed(2)}%`}
                </span>
                {" · 24H"}
              </>
            ) : (
              "24H —"
            )}
          </span>
        </>
      ) : (
        <>
          <span className="genx-hero-readout-value genx-hero-readout-figure">
            {preLaunch ? "PRE-LAUNCH" : "—"}
          </span>
          <span className="genx-hero-readout-sub">24H —</span>
        </>
      )}
    </div>
  );
}
