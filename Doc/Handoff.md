Here is the dedicated handoff document for the frontend and website stack. Save this as `GENX_WEBSITE_HANDOFF.md` in the root of your `genx-website` repository.

---

# 🌐 GENX WEBSITE & DASHBOARD — HANDOFF v1

**Purpose:** Resume frontend development, specifically for the Next.js dashboard, UI enhancements, and integrating the GenX equity candlestick charts.
**Target Path:** `C:\Users\PC\GenomeX\genx-website`
**Stack:** Next.js (App Router), React, Tailwind CSS, Recharts (or similar for charting).

---

## 1. ⚡ TL;DR — Where We Are

The backend engine (GenX) is running on a VPS and generating live trade data (JSON/JSONL formats in `live_results/session_*`). The frontend website exists but needs its UI upgraded, specifically to replace basic line charts with **OHLC Candlestick charts for GenX equity**, and to act as the landing page/client portal for the copy-trading bridge.

---

## 2. 🚀 Getting Started (Local Dev Environment)

**Prerequisites:**
- Node.js ≥ 18.17
- npm, yarn, or pnpm (check `package.json` for the lockfile used).

**Commands to start the dev server:**
```cmd
cd C:\Users\PC\GenomeX\genx-website
npm install
npm run dev
```

**Environment Variables (`.env.local`):**
Ensure the frontend knows where to fetch data. If the backend runs locally, it's usually `http://localhost:8000` or `http://localhost:8765` (bridge server).
```env
NEXT_PUBLIC_API_URL=http://localhost:8765
```

---

## 3. 🎯 The Immediate Next Task: Equity Candlestick Charts

Currently, the equity display likely uses a simple line chart. The goal is to render **OHLC (Open, High, Low, Close) Candlesticks** representing equity over time (e.g., aggregated by hour or day).

### Step A — Choose the Library
While `recharts` is popular, it doesn't have native, clean candlestick support out-of-the-box. **Recommendation:** Use **`lightweight-charts`** by TradingView.
- It is built exactly for this use case.
- It is incredibly fast and highly customizable.
- It looks professional and matches the "quant" aesthetic of GenX.

**Install it:**
```cmd
npm install lightweight-charts
```

### Step B — The Data Structure
The candlestick chart requires data in this shape:
```typescript
{
  time: string | number; // '2026-10-16' or UNIX timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}
```

### Step C — Aggregating Equity Data
Since GenX trades are recorded per-trade, you need to aggregate the `equity_curve` data into OHLC format before passing it to the chart.

**Helper function example (`utils/aggregateEquity.ts`):**
```typescript
export function aggregateEquityToCandles(trades: any[], intervalMinutes = 60) {
  // 1. Sort trades by timestamp
  // 2. Group by time bucket (e.g., start of every hour)
  // 3. For each bucket, calculate:
  //    - open: equity at the first trade in bucket
  //    - close: equity at the last trade in bucket
  //    - high: max equity in bucket
  //    - low: min equity in bucket
  // 4. Return array of { time, open, high, low, close }
}
```

### Step D — The React Component
Create `components/EquityCandlestickChart.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, ISeriesApi } from "lightweight-charts";

export default function EquityCandlestickChart({ data }: { data: any[] }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9CA3AF",
      },
      grid: {
        vertLines: { color: "rgba(156, 163, 175, 0.1)" },
        horzLines: { color: "rgba(156, 163, 175, 0.1)" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#10B981",     // Tailwind emerald-500
      downColor: "#EF4444",   // Tailwind red-500
      borderVisible: false,
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
    });

    candlestickSeries.setData(data);

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current!.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full h-[400px]" />;
}
```

---

## 4. 📁 Understanding the Data Layer

The frontend needs to read data that the Python engine generates.

### Where the data lives currently:
**Local machine:**
`C:\Users\PC\GenomeX\genX-feature-dashboard-enhancement\genX-feature-dashboard-enhancement\live_results\`

**VPS:**
`/home/administrator/.wine_mt5_weltrade/drive_c/GenX/live_results/`

Inside `session_YYYYMMDD_HHMMSS/` you will find:
- `events.jsonl`: Streaming equity snapshots and trade events.
- `trades.json`: The full trade history for that session.

### How the Frontend should consume it:
**Don't read files directly from the browser.** You need an API layer.
1. If using the FastAPI backend (`production/bridge_server.py`), add an endpoint like `/api/equity` that reads the latest session's `events.jsonl`, aggregates it, and returns the OHLC JSON.
2. The Next.js frontend fetches `GET /api/equity` and passes it to the chart component.

---

## 5. 📂 Key File Inventory

| File / Folder | Purpose |
|:--------------|:--------|
| `app/page.tsx` | The landing page (needs copy + CTA for GenX Bridge). |
| `app/dashboard/page.tsx` | The main trading dashboard. |
| `components/` | UI components. (Where the new `EquityCandlestickChart` goes). |
| `lib/api.ts` | Centralized file for fetch calls to the backend. |
| `tailwind.config.js` | Theme tokens (colors, fonts). |

---

## 6. 🎨 UI/UX Guidelines

Keep the aesthetic **dark, technical, and professional**. GenX is a quant tool, not a toy.
- **Background:** Slate-950 or pure black (`#000000` / `#0A0A0A`).
- **Text:** Slate-300 for body, White for headers.
- **Accents:** Emerald-500 for positive/buy, Red-500 for negative/sell, Indigo-500 for primary buttons.
- **Fonts:** Inter or JetBrains Mono for numbers (to make equity/PnL align perfectly).
- **Card UI:** Subtle borders (`border border-slate-800`), slight background blur (`bg-slate-900/50 backdrop-blur`).

---

## 7. 🎯 How to Continue (Prompt for the next assistant)

Paste this handoff into a new chat, then say:

> *"I'm working on the GenX Next.js website. The immediate task is to implement the Equity Candlestick Chart using `lightweight-charts` as described in Section 3. I also need a helper function to aggregate the trade data into OHLC format. Let's start by writing the aggregation logic and the chart component."*

---

## 8. 🚨 Known Issues & Blockers

1. **Live Data Connection:** The Next.js app currently might be mocking data or reading from a static JSON. It needs to be wired to the FastAPI bridge server (running on port `8765` locally or on the VPS) for real-time updates.
2. **CORS:** If the Next.js app (`port 3000`) fetches directly from FastAPI (`port 8765`), you will need to enable CORS in FastAPI (`fastapi.middleware.cors.CORSMiddleware`).
3. **Timezones:** Ensure timestamps from the backend are converted to the user's local timezone on the frontend before rendering on the chart.

---

*End of Website Handoff v1.*