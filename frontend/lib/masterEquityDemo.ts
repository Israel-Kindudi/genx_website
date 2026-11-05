// Development-only simulated master account. Never imported in production builds.
import type { MasterPoint, MasterSummary } from "@/lib/useMasterEquity";

const DAY = 86_400_000;
const INITIAL = 25_000;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createMasterDemo() {
  const rand = rng(20260211);
  const now = Date.now();
  let equity = INITIAL;
  let balance = INITIAL;
  const points: MasterPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    equity *= 1 + (rand() - 0.42) * 0.012;
    // balance only realises a small part of the floating PnL, so the gap stays visible
    balance += (equity - balance) * 0.18;
    points.push({
      timestamp: new Date(now - i * DAY).toISOString(),
      equity: Math.round(equity * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }
  const dayStart = points[points.length - 2].equity;
  let cycle = 4180;
  let openPositions = 3;
  let wins = 312;
  let closed = 497;

  function summaryFor(eq: number): MasterSummary {
    return {
      equity: eq,
      balance: Math.round(balance * 100) / 100,
      cycle,
      open_positions: openPositions,
      timestamp: new Date().toISOString(),
      initial_capital: INITIAL,
      account_currency: "USD",
      pnl_today: Math.round((eq - dayStart) * 100) / 100,
      pnl_total: Math.round((eq - INITIAL) * 100) / 100,
      win_rate: Math.round((wins / closed) * 1000) / 10,
      trades_closed: closed,
    };
  }

  return {
    initial: { points, summary: summaryFor(equity) },
    tick() {
      equity *= 1 + (rand() - 0.47) * 0.0016;
      equity = Math.round(equity * 100) / 100;
      cycle += 1;
      if (rand() < 0.1) openPositions = Math.max(0, Math.min(6, openPositions + (rand() < 0.5 ? -1 : 1)));
      if (rand() < 0.2) {
        closed += 1;
        if (rand() < 0.63) wins += 1;
        balance += (equity - balance) * 0.25;
      }
      const point: MasterPoint = {
        timestamp: new Date().toISOString(),
        equity,
        balance: Math.round(balance * 100) / 100,
      };
      return { point, summary: summaryFor(equity) };
    },
  };
}
