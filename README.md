# 🎨 GenX — Frontend Engineer Handoff

**Audience:** Frontend Engineer (Next.js / React / TypeScript)  
**Status:** Production platform live at `https://genx.vortech.markets`  
**Next phase:** Multi-tenant dashboard, master equity on landing, advanced charting, bridge status UI.

---

## 1. 🎯 The Current State (What You're Inheriting)

The GenX frontend is fully deployed and functional. It is a **Next.js 14 App Router** application, styled with Tailwind (dark terminal aesthetic, obsidian `#0B0F17`, emerald accents), and served via PM2 + Nginx.

**You do not need to touch the backend to ship the work below.** Every endpoint already exists and is documented in Section 8.

### What works today

| Surface | Status | File |
|:---|:---|:---|
| Landing page (Hero, Vision, Pricing) | ✅ Live | `app/page.tsx`, `components/PricingSection.tsx` |
| Login / Register / Verify Email | ✅ Live | `app/login/`, `app/register/`, `app/verify-email/` |
| Checkout (stub payment) | ✅ Live | `app/checkout/[planCode]/page.tsx` |
| Dashboard shell (sidebar, WS status) | ✅ Live | `app/(dashboard)/dashboard/layout.tsx` |
| Overview (equity chart, KPIs) | ✅ Live | `components/LiveTerminal.tsx` |
| Trades, Performance, VTGX, Mining, Audit | ✅ Live | `app/(dashboard)/dashboard/*/page.tsx` |
| Admin Users panel | ✅ Live | `app/(dashboard)/dashboard/users/page.tsx` |
| Billing & subscription management | ✅ Live | `app/(dashboard)/dashboard/billing/page.tsx` |

### What is mocked or missing (your work)

| Gap | Why it matters |
|:---|:---|
| **No master equity on landing** | The hero needs live proof of master account performance — the marketing hook. |
| **Client equity is demo-only** | The dashboard uses the demo provider (`lib/datafeed/demo/`). The backend has no per-client equity endpoint yet, so the frontend will need a small guard for missing data. |
| **VTGX chart is mock** | `lib/datafeed/mock/mockProvider.ts` generates fake bars. The real provider (`lib/datafeed/real/realProvider.ts`) is a stub. |
| **No bridge connection status** | Users have no way to know if their local MT5 bridge is online. |
| **No advanced charting** | Candlesticks with trade markers, hour×weekday heatmap, per-symbol PnL breakdown are all missing. |
| **No signal feed** | The dashboard doesn't show the incoming signals (buy/sell with entry/SL/TP) even though the master hub generates them. |

---

## 2. 🗺️ The Work Map (Prioritized)

Work top to bottom. Each item is independently shippable.

### Priority 0 — Landing Page Master Equity (1 day)

**Goal:** Replace the static hero with a live master equity curve sourced from the backend.

**Design:**
- Below the hero heading, add a card titled **"Live Master Account Performance"**
- Shows: current equity, PnL (today and all-time), cycle count, win rate
- One `<AreaChart>` (Recharts) showing the master equity over the last 30 days
- Small green pulse dot + "LIVE" badge (or grey "OFFLINE" if the WS disconnects)

**Data source (needs backend):**
- WS event: `{"type": "master_equity", "data": {equity, balance, cycle, timestamp, initial_capital, account_currency}}`
- HTTP fallback: `GET /api/public/master/equity` → last 30 daily snapshots

**Implementation:**
1. Create `components/MasterEquityCard.tsx` — self-contained, uses `useMasterEquity()` hook.
2. Create `lib/useMasterEquity.ts` — subscribes to the WS, keeps last N points in state.
3. If the WS is disconnected on load, fall back to the HTTP endpoint.
4. Add `<MasterEquityCard />` in `app/page.tsx`, right after the hero section.

**Guardrails:**
- No fake data — if the backend is unreachable, show a "Performance coming soon" empty state.
- The card must not shift the page layout during load (reserve height).
- Must be responsive: full-width card on mobile, 3-column KPIs + chart on desktop.

---

### Priority 1 — Client Equity from the Bridge (2–3 days)

**Goal:** The dashboard currently uses the demo provider. It needs to consume real per-client equity from the backend, which will receive it from the client's bridge.

**Backend contract (in progress by backend team):**
```json
// WS event (per authenticated client)
{
  "type": "client_equity",
  "bridge_id": "br_abc123",
  "data": {
    "equity": 10050.50,
    "balance": 10000.00,
    "open_positions": 2,
    "cycle": 42,
    "initial_capital": 10000.00,
    "account_currency": "USD",
    "timestamp": "2026-11-02T..."
  }
}
```

**Implementation:**
1. In `lib/useLiveTrades.ts`, add a filter: only append `client_equity` events where `bridge_id === currentUserBridgeId`. Get `currentUserBridgeId` from `GET /api/bridge/me` (new endpoint) or from `/api/auth/me`.
2. Replace the demo provider with the real one — remove `lib/datafeed/demo/` from the production bundle, use `lib/accountDataProvider.ts`'s live path.
3. If `client_equity` events are missing (bridge offline), keep the chart frozen (already implemented) and show a "Bridge offline" banner.

**Guardrails:**
- Same disconnect behavior as the master: freeze the chart, keep last-known values.
- Distinguish between "master equity" (public) and "my equity" (private) in the code — they are different hooks with different auth.
- Do not show another user's bridge data — filter on the client side even though the backend also filters.

---

### Priority 2 — Bridge Connection Status Widget (1 day)

**Goal:** Give the user visibility into their bridge's connection state. This is critical for SaaS UX — a trader needs to know if their local MT5 is actually executing.

**Design:**
- Persistent widget in the dashboard sidebar footer (below "Sign out")
- Shows: `● Bridge: Connected / Disconnected / Never Installed`
- Hover shows: last sync time, bridge version, latency (ms)
- Click opens a small modal with instructions ("Install the bridge" or "Bridge is running")

**Data source:**
- `GET /api/bridge/me` → `{bridge_id, status: "connected"|"disconnected"|"never", last_seen, version, latency_ms}`
- Or WS event: `{"type": "bridge_status", "data": {...}}`
- Update every 10 seconds

**Implementation:**
1. Create `components/BridgeStatusWidget.tsx`
2. Create `lib/useBridgeStatus.ts` — polls `GET /api/bridge/me` every 10s
3. Mount in `app/(dashboard)/dashboard/layout.tsx` (footer section)

**Guardrails:**
- "Never Installed" state must include a clear CTA — a modal with install instructions and a download link.
- Do not show a red "DISCONNECTED" for a brand-new user who hasn't installed anything yet — that's "Never Installed," not a failure state.

---

### Priority 3 — Advanced Charting (3–4 days)

**Goal:** Replace the placeholder `VtgxCandlestickChart.tsx` and add three new analytics charts.

**Four new charts:**

#### 3a. Candlestick chart with trade markers

- Use `lightweight-charts` (already in `package.json`) — replaces the current mock chart
- Overlay trade entry/exit markers as arrows (green up for BUY, red down for SELL)
- Support period toggles (1H, 1D, 1W, 1M)
- Support timeframe toggles (1m, 5m, 15m, 1H, 4H, 1D)

**Data source:**
- Chart: `/api/market/bars?symbol={sym}&timeframe={tf}&from={ts}&to={ts}` (needs backend)
- Trades: from existing `useLiveTrades` state

#### 3b. Per-symbol PnL bar chart

- Horizontal bar chart showing net PnL per symbol
- Sort descending, top 10 symbols
- Color: green for profit, red for loss
- Data: derived from existing `trades` state — no new endpoint needed

#### 3c. Hour × Day-of-week PnL heatmap

- 24 columns (hours) × 7 rows (days)
- Color scale: red → neutral → green
- Hover shows: trades count, win rate, average PnL
- Data: derived from existing `trades` state (group by `new Date(trade.exit_time).getHours()`)

#### 3d. Rolling win rate line

- Line chart of win rate over the last 20 trades (rolling window)
- Reference line at 55% (the KPI target)
- Data: derived from existing `trades` state

**Implementation plan:**
1. Create `components/charts/CandlestickChart.tsx` (already partially exists as `VtgxCandlestickChart.tsx` — extend it)
2. Create `components/charts/SymbolPnLBar.tsx`
3. Create `components/charts/HourWeekdayHeatmap.tsx`
4. Create `components/charts/RollingWinRate.tsx`
5. Create `components/ChartDeck.tsx` — tabbed container that hosts all four
6. Replace the chart area in `LiveTerminal.tsx` with `<ChartDeck />`

**Guardrails:**
- All charts must handle empty data gracefully (no NaN axes, no crash)
- Each chart must have an export-to-PNG button (users will want to share)
- Mobile: charts should be usable at 375px width

---

### Priority 4 — Signal Feed (2 days)

**Goal:** A live feed of incoming master signals on the dashboard, so users see what's happening in real time (before the trade even executes on their bridge).

**Design:**
- Right-hand panel in the Overview (replacing or next to the current trade feed)
- Each signal shows:
  - Timestamp
  - Symbol + Action (BUY/SELL)
  - Entry / SL / TP
  - Strategy name
  - Status: `Sent` → `Executed` (turns green) or `Failed` (turns red)
  - Hover: signal ID, routing info

**Data source (new endpoint needed):**
- WS event: `{"type": "signal", "data": {signal_id, symbol, action, entry, sl, tp, strategy, timestamp}}`
- Status updates: `{"type": "signal_ack", "signal_id": "...", "status": "executed"|"failed", "ticket": ...}`

**Implementation:**
1. Create `components/SignalFeed.tsx`
2. Create `lib/useSignals.ts` — subscribes to WS, keeps last 50 signals with status
3. Mount in `LiveTerminal.tsx` right-hand column

**Guardrails:**
- Do not show signals for symbols the user's plan doesn't include (compare against `useMySubscription().plan`)
- Expired signals (> 60s old) should show as greyed out

---

## 3. 🎨 Design System (Match the Existing)

You must match the existing visual language. Here are the primitives:

| Element | Value |
|:---|:---|
| Background | `#0B0F17` |
| Surface | `#111625` |
| Border | `#1E293B` |
| Cyan accent (positive/active) | `#06B6D4` |
| Emerald (success) | `#10B981` |
| Rose (danger) | `#F43F5E` |
| Amber (warning) | `#F59E0B` |
| Font | System sans (Tailwind `font-sans`), mono for numbers |
| Radius | `rounded-xl` (cards), `rounded-lg` (inputs) |
| KPI label | `text-xs uppercase tracking-wide text-slate-500` |
| KPI value | `text-lg font-mono font-bold text-white` |

**Reusable components:**
- `components/KPI.tsx` — the KPI card used in LiveTerminal
- `components/PlanCard.tsx` — pricing card
- `components/UsageMeter.tsx` — quota bar
- `components/ChartTooltip.tsx` — animated tooltip

**Do not introduce new colors or fonts.** If you need a new accent, ask first.

---

## 4. 🚨 Guardrails & Invariants (Do Not Violate)

These exist for reasons. Breaking them breaks production.

### 4.1 No `http://` URLs

The production site is HTTPS. Any `http://` URL in the bundle causes mixed-content errors that silently break the page.

**Rule:** Every API base must fall back to `window.location.origin`:

```typescript
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000");
```

This pattern is already applied in `lib/api.ts`, `lib/usePlans.ts`, `lib/useLiveTrades.ts`, `lib/useLiveSocket.ts`. **Extend it — never hardcode a domain.**

### 4.2 Disconnect = Freeze, Not Clear

When the WebSocket disconnects, the equity chart **must stay visible** with the last-known values. The badge shows "DISCONNECTED", but the data remains. This is a UX requirement, not a bug.

**Existing behavior** in `useLiveTrades.ts` and `LiveTerminal.tsx` already handles this. Do not "fix" it.

### 4.3 No Google Fonts

The VPS cannot reach `fonts.googleapis.com`. All fonts are system fonts, loaded via `tailwind.config.js` `fontFamily`. Do not add `next/font/google` imports — they will break the build.

### 4.4 The Landing Page Must Work Without Auth

The landing page (hero, pricing, master equity) must render fully for anonymous visitors. Never require a token for public content.

### 4.5 Distinguish Public vs. Private Data

- **Master equity** (`master_equity` event) — public, shown on landing, visible to anonymous users
- **Client equity** (`client_equity` event) — private, filtered by `bridge_id`, shown only on authenticated dashboards

Do not mix these. Do not show master data in the client dashboard. Do not show client data on the landing.

### 4.6 Handle Empty States Gracefully

Every chart, KPI, and table must have a proper empty state. No `NaN`, no `undefined.toFixed(2)`, no blank white area. Use "Waiting for data…" or "Bridge not connected" or "No trades yet".

### 4.7 Types From `lib/usePlans.ts` Are the Contract

The `Plan` interface in `lib/usePlans.ts` mirrors the backend's `PlanOut`. Do not add client-only fields. If you need more data, ask the backend to extend the schema.

---

## 5. 🧪 Testing Checklist

Before merging, verify:

```bash
# 1. Build passes with no type errors
cd frontend
rm -rf .next
NEXT_PUBLIC_API_BASE_URL=https://genx.vortech.markets npm run build

# 2. No mixed content — grep the built bundle
grep -rE "http://genx\.vortech\.markets" .next/static/chunks/*.js 2>/dev/null | wc -l
# Must print: 0

# 3. No localhost in bundle
grep -rE "http://localhost" .next/static/chunks/*.js 2>/dev/null | wc -l
# Must print: 0

# 4. No Google Fonts references
grep -rE "next/font/google" app/ components/ lib/ 2>/dev/null
# Must print nothing
```

**Browser tests:**
- Landing page loads without errors
- Pricing renders 5 cards
- Login works
- Dashboard loads after login
- Equity chart renders (from demo provider for now)
- Hard refresh (Ctrl+Shift+R) — no stale cache issues
- Private window — no mixed content warnings in console
- F12 → Application → Clear site data → reload → everything still works

**Mobile tests** (Chrome DevTools → device mode → iPhone 12):
- Sidebar collapses to hamburger
- Charts remain legible
- KPI grid reflows to 2 columns
- Table scrolls horizontally

---

## 6. 🔌 Backend Contracts (What You'll Consume)

Every endpoint you need already exists or is being built. Here's the reference.

### Existing endpoints (live today)

| Endpoint | Purpose | Auth |
|:---|:---|:---|
| `GET /api/public/plans` | Landing pricing | No |
| `POST /api/auth/register` | Register + get JWT | No |
| `POST /api/auth/token` | Login | No |
| `GET /api/auth/me` | Current user | JWT |
| `POST /api/auth/verify-email` | Verify via token | No |
| `GET /api/subscriptions/me` | Current plan + usage | JWT |
| `GET /api/subscriptions/invoices` | Invoice history | JWT |
| `POST /api/checkout/session` | Create checkout intent | JWT |
| `POST /api/checkout/confirm` | Confirm payment | JWT |
| `GET /api/auth/users` | Admin: user list | JWT admin |
| `PATCH /api/auth/users/{id}` | Admin: update user | JWT admin |
| `WS /ws/live` | Live equity + trades | (unauthenticated — will be secured) |

### New endpoints (backend team building)

| Endpoint | Purpose | Status |
|:---|:---|:---|
| `GET /api/public/master/equity` | Last 30 days master equity | Planned |
| `GET /api/bridge/me` | Current user's bridge status | Planned |
| `GET /api/market/bars` | Historical OHLCV for candlestick chart | Planned |
| WS `master_equity` event | Live master equity | Planned |
| WS `client_equity` event | Live client equity | Planned |
| WS `signal` event | Incoming signals | Planned |
| WS `bridge_status` event | Bridge connection state | Planned |

**When the endpoint isn't ready:** stub the hook with a `comingSoon` flag and render the empty state. Do not fake data.

---

## 7. 📁 File Map (What's Where)

```
frontend/
├── app/
│   ├── page.tsx                        ← Landing (add MasterEquityCard here)
│   ├── login/page.tsx                  ← Auth
│   ├── register/page.tsx
│   ├── verify-email/page.tsx
│   ├── checkout/[planCode]/page.tsx    ← Plan chooser
│   └── (dashboard)/dashboard/
│       ├── layout.tsx                  ← Add BridgeStatusWidget here
│       ├── page.tsx                    ← Overview (LiveTerminal)
│       ├── performance/page.tsx
│       ├── trades/page.tsx
│       ├── vtgx/page.tsx
│       ├── billing/page.tsx
│       └── users/page.tsx
├── components/
│   ├── LiveTerminal.tsx                ← Replace chart area with ChartDeck
│   ├── PricingSection.tsx
│   ├── PlanCard.tsx
│   ├── UsageMeter.tsx
│   ├── ChartTooltip.tsx
│   ├── MonthlyHeatmap.tsx
│   └── VtgxCandlestickChart.tsx        ← Extend, rename to CandlestickChart
├── lib/
│   ├── api.ts                          ← axios client
│   ├── auth.ts                         ← token storage
│   ├── usePlans.ts
│   ├── useMySubscription.ts
│   ├── useLiveTrades.ts                ← Extend for client_equity filtering
│   ├── useLiveSocket.ts                ← WS status
│   ├── useAccountDataProvider.ts       ← Live vs demo
│   └── datafeed/
│       ├── mock/                       ← Fake bars (dev only)
│       ├── demo/                       ← Demo account fixtures (dev only)
│       └── real/                       ← Stub for real provider
└── tailwind.config.js                  ← System fonts, colors
```

---

## 8. 🎯 Definition of Done

A feature is "done" when:

1. **Types pass** — `npm run build` succeeds without errors
2. **No mixed content** — no `http://` URLs in the bundle
3. **Empty state exists** — if data is missing, user sees a meaningful message
4. **Loading state exists** — skeleton or spinner, not blank
5. **Error state exists** — if an API call fails, show the error gracefully
6. **Mobile works** — at 375px width (iPhone SE), layout doesn't break
7. **Matches design system** — colors, fonts, spacing from Section 3
8. **Does not break existing** — landing, login, dashboard, billing all still work

**Do not merge if any of these fail.** If you're unsure, ask before shipping.

---

## 9. 🚦 Getting Started — Your First 30 Minutes

1. **Clone the repo:**
   ```bash
   git clone https://github.com/Israel-Kindudi/genX.git
   cd genX/frontend
   npm install
   ```

2. **Set env vars:**
   ```bash
   echo "NEXT_PUBLIC_API_BASE_URL=https://genx.vortech.markets" > .env.local
   ```

3. **Run dev:**
   ```bash
   npm run dev
   # → http://localhost:3000
   ```

4. **Read these files in order:**
   - `lib/api.ts` — how API calls work
   - `lib/auth.ts` — how tokens work
   - `lib/usePlans.ts` — how pricing works
   - `lib/useLiveTrades.ts` — how WebSocket works
   - `components/LiveTerminal.tsx` — the current equity dashboard
   - `components/PricingSection.tsx` — the pricing UI

5. **Verify the build:**
   ```bash
   rm -rf .next
   npm run build
   # → should succeed with 14 routes
   ```

6. **Then start with Priority 0** — the landing page master equity card.

---

## 10. 📚 Reference Documents

Read these before starting:

- **`GENX_ARCHITECTURE_HANDOFF.md`** — the full system architecture, data flows, and design decisions
- **`PRODUCTION_HANDOFF.md`** — ops runbook (what's deployed where)
- **`GENX_CONTEXT.md`** — original project context, roadmap, KPIs
- **Live API docs:** `https://genx.vortech.markets/docs`

---

## 11. 🧠 The Mindset

You're not just building UI. You're building **the interface between a customer and their trading engine**. Every number on that screen represents real money. A user who sees stale equity might think their account is dead. A user who sees another user's data will churn immediately. A user who sees a chart that hasn't updated in an hour will lose trust.

**Be paranoid about correctness. Be honest about what's real vs. what's mock. Be ruthless about empty states.**

If something looks wrong, it probably is. Ask before guessing. The backend team is available.

---

**Welcome to GenX. The platform is live, users are paying (structurally), and the next 2–3 weeks of work will turn it from a shell into a product.** 🧬

*Save this as `FRONTEND_HANDOFF.md` and pass it to your engineer. Pair it with `GENX_ARCHITECTURE_HANDOFF.md` for full context.*
