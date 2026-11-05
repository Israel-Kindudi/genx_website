# GenX Website — Backend Integration Handoff

**Version:** 1.0  
**Audience:** Backend architect, payments engineer, trading-engine integrator  
**Scope:** Backend/API work required to make the current GenX website and dashboard data-driven and operational.

> This handoff supplements [`Handoff.md`](./Handoff.md) and [`Dashboard_Pricing_Signin_Handoff.md`](./Dashboard_Pricing_Signin_Handoff.md). It focuses on the current implementation and its backend dependencies, not on visual redesign. Treat endpoint examples marked **proposed** as contracts to agree before implementation; they are not claims that those routes already exist.

## 1. Executive summary

The frontend now contains production-oriented UI for public master-account readouts, master-equity history, account-level dashboard data, VTGX market charts, plan selection, hosted checkout, trial messaging, subscription management, fuel/refuels, and timestamped trades.

Several paths already have a backend route, but are incomplete or not safe to treat as production billing:

1. `GET /api/public/master/equity` exists and supplies public master history and summary. `/ws/live` exists, but currently broadcasts an unauthenticated stream and replays only a bounded recent buffer.
2. The real VTGX provider is still an empty stub; benchmark production data is also unavailable.
3. `POST /api/payments/checkout` exists but returns a placeholder URL, not a provider-confirmed payment flow.
4. `POST /api/subscriptions/change` currently changes the plan and creates a `paid` invoice immediately. It is not payment-gated and must not be used as a production charge/upgrade path until corrected.
5. Fuel endpoints (`GET /api/fuel/me`, `POST /api/fuel/topup`) and early renewal (`POST /api/subscriptions/renew`) are not implemented. The frontend no longer simulates fuel or payment results.
6. Public Starter pricing presents 500 free one-time cycles followed by Starter billing. Registration currently assigns the internal Trial plan but does not record specific recurring-payment authorization, store a payment method, or convert at cycle depletion.

The frontend should never be treated as the authority for plan entitlements, payment amounts, cycle balances, or account access. The backend must derive those from authenticated user, active subscription, plan catalogue, provider-confirmed payment events, and authoritative engine usage.

## 2. Current frontend surfaces and source files

| Surface | Current source | Backend dependency |
|---|---|---|
| Public header readouts | `frontend/components/HeroReadouts.tsx`, `frontend/lib/useMasterEquity.ts`, `frontend/lib/useVtgxQuote.ts` | Public master equity snapshot/stream; real VTGX quote and 24-hour market data |
| Public master-equity chart | `frontend/components/MasterEquityCard.tsx`, `frontend/lib/MasterEquityContext.tsx` | Historical master equity/balance points and live updates |
| Dashboard equity, analytics, and trade markers | `frontend/components/LiveTerminal.tsx`, `frontend/lib/useLiveTrades.ts`, `frontend/lib/dashboardAnalytics.ts` | Account-scoped equity, trades, and signed capital flows, with history bootstrap and live updates |
| VTGX chart | `frontend/components/VtgxCandlestickChart.tsx`, `frontend/lib/vtgxDatafeed.ts`, `frontend/lib/datafeed/real/realProvider.ts` | Authorized historical OHLCV and live bars; real provider is currently a stub |
| Public plan cards | `frontend/components/PricingSection.tsx`, `frontend/lib/usePlans.ts` | `GET /api/public/plans`; prices and entitlements remain server-authoritative |
| Billing plan selection | `frontend/app/(dashboard)/dashboard/billing/plans/page.tsx`, `frontend/components/PlanCard.tsx` | Authenticated plan list, current subscription/cadence, and payment-gated plan changes |
| Checkout | `frontend/app/checkout/[planCode]/page.tsx`, `frontend/components/CheckoutForm.tsx`, `frontend/lib/useCheckout.ts` | Payment session creation, provider redirects, webhook-confirmed completion |
| Billing and fuel | `frontend/app/(dashboard)/dashboard/billing/page.tsx`, `frontend/components/FuelPanel.tsx`, `frontend/lib/useFuel.ts` | Fuel balance, quotes, refuel payment, renewals, invoices |
| Trade history | `frontend/app/(dashboard)/dashboard/trades/page.tsx` | Durable, account-scoped trades with entry and exit timestamps |
| Trial-to-Starter offer | `frontend/components/PricingSection.tsx`, `frontend/lib/authRedirect.ts`, `frontend/components/AuthPage.tsx` | Trial entitlement, explicit recurring consent, saved payment method, depletion trigger and conversion |

Pure presentation work (logo, gradients, animation, chart layout, responsive styling, etc.) is intentionally outside this handoff. Firm XL's **Contact Sales** action opens Vortech Markets WhatsApp at `https://wa.me/243832082287`; this action does not require a backend endpoint.

## 3. Integration status: existing versus required

| Capability | Current implementation | Backend work / release status |
|---|---|---|
| Public plan catalogue | `GET /api/public/plans` and authenticated `GET /api/subscriptions/plans` exist | Keep plan codes stable; verify all prices, feature fields, and cycle allowances against the agreed catalogue |
| Current subscription | `GET /api/subscriptions/me` exists | Persist and return `billing_cycle`; `Subscription` has no such column and `SubscriptionOut` omits it (the separate `PaymentIntent` model does have a billing-cycle field) |
| Public master history | `GET /api/public/master/equity` exists | Validate that it reads only the designated public master account; improve history granularity/retention if required |
| Live stream | `/ws/live` exists | Separate public master data from private user/account data; authenticate and authorize private streams |
| VTGX market data | `realProvider` returns empty bars and has no-op subscriptions | Implement authorized source/proxy and connect it to the provider interface |
| Benchmark market data | Production provider returns no data | Optional integration for VTGX/BTCUSD/XAUUSD/SP500 comparison series |
| Checkout | `POST /api/payments/checkout` exists as a stub | Provider session, server-derived amount, status persistence, signed webhook, idempotent fulfillment |
| Plan switching | `POST /api/subscriptions/change` exists | Must be gated by verified payment; current route activates plan and marks invoice paid without charging |
| Fuel balance/refuel | No `/api/fuel/me` or `/api/fuel/topup` route found | Implement authoritative ledger, quote, payment and fulfillment |
| Early renewal | No `/api/subscriptions/renew` route found | Implement payment-gated renewal and cycle allocation |
| Trial conversion | Registration assigns Trial | Implement 500-cycle one-time grant, consent/payment setup and automatic conversion policy |
| Trade history | `/ws/live` events only for the live Trades page | Add authenticated historical query; current browser state is not a durable history |

## 4. Core product rules the backend must enforce

### 4.1 Cycles and engine runtime

- One cycle represents **45 seconds of engine-on runtime**.
- Fuel is one balance shared across the user's connected accounts. Concurrent engines/accounts must not multiply consumption. Paused or stopped engine time consumes nothing.
- Preserve fractional elapsed runtime between accounting ticks so repeated short intervals do not lose or overcharge cycles.
- Consume subscription-plan cycles first, then purchased/refuel cycles.
- Plan cycles expire/reset according to the subscription billing term. Purchased cycles never expire and remain with the user across plan changes.
- On zero balance: prevent opening new trades; do **not** forcibly close existing positions.
- Enforce and record cycle consumption server-side. The browser's displayed balance, charts, timers, and any submitted quantity are not authoritative.

### 4.2 Plan catalogue and billing terms

Keep existing plan codes and expose one canonical catalogue to both public pricing and authenticated billing:

| Plan code | Monthly price | Annual price | Monthly cycles | Annual grant |
|---|---:|---:|---:|---:|
| `trial` | $0 | $0 | 500 one-time | Not applicable |
| `starter` | $49 | $490 | 3,840 | 46,080 |
| `pro` | $119 | $1,190 | 9,600 | 115,200 |
| `firm` | $299 | $2,990 | 28,800 | 345,600 |
| `firm_xl` | $1,299 (seed) | $12,990 (seed) | 48,000 | 576,000 if annual contract is supported |

The frontend's four public paid cards intentionally omit the separate `trial` row. Starter is presented as **$0.00 / “Free trial with 500 cycles”**, then the selected Starter price: **Then $49/mo** or **Then $490 billed yearly**. These are marketing/UI values; the server must return and charge the actual product terms. Firm XL has seeded monthly/yearly values, but the frontend treats it as contact-sales-only; confirm whether these seed prices are indicative or contractual before enabling self-service checkout.

Annual subscriptions grant 12 monthly allowances upfront. The full balance is usable during the paid annual term and expires at term end if unused. The `Subscription` record/API must include `billing_cycle: "monthly" | "yearly"` and authoritative term start/end. The current model has no subscription billing-cycle column; `PaymentIntent` has a billing-cycle field, but the subscription route does not persist/return the selected value. Add the subscription field and migration, assign it on successful payment, and include it in `SubscriptionOut`. `Plan.max_cycles` is the monthly catalogue allowance; do not make the frontend infer the active allowance from it when `/api/fuel/me` can return the authoritative value.

### 4.3 Refuel and early renewal

- One refuel adds exactly one full allowance for the active billing term: monthly allowance for monthly plans, 12× for annual plans.
- Refuel price is 50% of the active plan's undiscounted price for that same term. Annual refuel adds the annual allowance and costs 50% of the annual price.
- Firm XL must use the negotiated contract price/rate held by the backend, never a hard-coded UI price.
- Purchased/refuel cycles are credited only after verified payment and never expire.
- “Renew now” starts a new paid term immediately after successful payment, preserves existing unused cycles as agreed, then adds the new term allowance. Plan-change treatment is separate: retain purchased cycles; replace the subscription-cycle bucket on a plan change (define any prorated credit explicitly before launch).

## 5. Public master readouts and Master Equity chart

### 5.1 Existing contract

`useMasterEquity()` requests `GET /api/public/master/equity` and opens `/ws/live`. The response shape currently consumed by the page is:

```json
{
  "available": true,
  "points": [
    {
      "timestamp": "2026-11-05T00:00:00Z",
      "equity": 12540.25,
      "balance": 12310.25
    }
  ],
  "summary": {
    "equity": 12540.25,
    "balance": 12310.25,
    "cycle": 120,
    "open_positions": 2,
    "timestamp": "2026-11-05T00:00:00Z",
    "initial_capital": 10000,
    "account_currency": "USD",
    "pnl_today": 120.5,
    "pnl_total": 2540.25,
    "win_rate": 62.5,
    "trades_closed": 40
  }
}
```

If there is no public master data, return a valid empty shape (`available: false`, `points: []`, `summary: null`) rather than fabricated values. Each point needs a parseable ISO-8601 timestamp with timezone, numeric equity, and nullable balance.

The header Master Equity pill and Master Equity chart share one client connection/state provider. Keep their live values/status consistent. The chart uses equity and, when available, balance. The readout also needs current equity, balance, open-position count and a correctly defined performance percentage.

### 5.2 Performance window discrepancy to resolve

The header currently displays a `24H` label but derives its percentage from `pnl_today` and the inferred start-of-day equity. These are not necessarily the same window. Choose one canonical behavior:

1. Prefer true rolling 24-hour performance and supply `pnl_24h` plus a matching 24-hour reference equity or percentage in the summary; or
2. Change the UI label to “Today” and retain `pnl_today`.

Do not silently label daily PnL as a rolling 24-hour return. The percentage denominator must be positive and the reference timestamp/window must be defined in UTC.

### 5.3 History and stream expectations

- Current backend route scans `live_results/session_*/events.jsonl` and reduces history to daily points over a 30-day window plus the latest point. Confirm that these directories represent only the designated public master account; never aggregate unrelated users into a public response.
- Provide enough history for the selected chart range and a stable latest snapshot. If retaining daily sampling, document that intraday detail is not available in the public Master chart.
- The frontend expects live equity messages with `type: "equity"` or `"master_equity"`, `session_id`, UTC `timestamp`, and `data` fields: `equity`, `balance`, `cycle`, `open_positions`, `initial_capital` (or `initialCapital`), and `account_currency` (or `currency`).
- Emit balance when known; otherwise use `null`, not a fabricated zero.
- On reconnect, ensure the REST history snapshot and stream updates cannot reorder or overwrite newer values. Consider sequence IDs or an `as_of` timestamp.

## 6. Private dashboard data: equity, performance, capital flows and trades

### 6.1 Current WebSocket consumer

`frontend/lib/useLiveTrades.ts` consumes `/ws/live` envelopes:

```json
{ "type": "equity", "session_id": "session_...", "timestamp": "ISO-8601 UTC", "data": {} }
{ "type": "trade_open", "session_id": "session_...", "timestamp": "ISO-8601 UTC", "data": {} }
{ "type": "trade_close", "session_id": "session_...", "timestamp": "ISO-8601 UTC", "data": {} }
{ "type": "capital_flow", "session_id": "session_...", "timestamp": "ISO-8601 UTC", "data": {} }
```

Required equity fields: `equity`, `balance`, `open_positions`, `cycle`, `initial_capital` (or `initialCapital`) and `account_currency` (or `currency`).

Required `trade_open` fields: stable trade identifier/ticket, `strategy`, `symbol`, `action` (`BUY`/`SELL`), `entry_price`, `lot`, optional `sl`, `tp`, optional `regime`. The event timestamp is the authoritative `entry_time`.

Required `trade_close` fields: same stable trade identifier, `exit_price`, realized `pnl`; event timestamp is the authoritative `exit_time`. Ensure both entry and exit are preserved in durable history.

Required `capital_flow` fields: signed numeric `amount` (deposit positive, withdrawal negative) and UTC timestamp. Use a single agreed currency per account or include the currency explicitly. Flow timing/order relative to equity snapshots must be deterministic.

### 6.2 Privacy and history gap

The existing `/ws/live` accepts connections without authentication. `EngineWatcher` tails only the newest session file and replays a bounded in-memory buffer (500 events). This is not sufficient for private account history and risks exposing account data if private events are broadcast on this public socket.

Before using this stream for customer accounts:

- Keep the public master stream separate from authenticated user/account streams.
- Authenticate the WebSocket (e.g. short-lived ticket or approved bearer-token handshake) and authorize every requested account/session server-side.
- Never rely on a client-supplied `session_id` as proof of ownership.
- Add REST bootstrap/history because a bounded event replay cannot provide complete history or guarantee reconnection recovery.
- Emit durable, stable identifiers; ticket alone may collide across accounts/sessions. Prefer an immutable trade ID or composite `(account_id, session_id, ticket)`.

**Proposed account APIs** (final route names may follow the backend's conventions):

- `GET /api/account/snapshot?account_id=...` — latest equity/balance, initial capital, currency, open-position count and `as_of`.
- `GET /api/account/equity?account_id=...&from=...&to=...&cursor=...` — ordered equity/balance points with pagination and documented retention.
- `GET /api/account/trades?account_id=...&status=...&from=...&to=...&cursor=...` — durable open/closed trades, including entry and exit timestamps.
- `GET /api/account/capital-flows?account_id=...&from=...&to=...&cursor=...` — signed deposits/withdrawals.
- Authenticated WebSocket for incremental account events, with replay cursor/sequence support.

These are recommendations, not routes already wired by the frontend. The frontend currently accumulates live events in browser memory; Trades uses up to 500 records and the analytics pages use finite client-side buffers. That cannot provide a full account statement or guarantee a complete `ALL` period. Decide whether official analytics should be server-calculated or explicitly remain client-side estimates over a defined history window.

### 6.3 Timestamp semantics

The Trades table now has separate **Opened** and **Closed** columns. Open trades display their entry timestamp and `—` for close time; closed trades display both. Send timestamps as RFC 3339/ISO-8601 with explicit UTC offset (prefer `Z`), never naive local timestamps. The UI formats them in the viewer's local timezone. The detail panel also reads `entry_time` and `exit_time`.

## 7. VTGX market data and benchmark feeds

### 7.1 VTGX provider contract

The shared interface in `frontend/lib/vtgxDatafeed.ts` accepts historical bars and live subscriptions. Supported timeframes are `1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `4H`, `8H`, `12H`, `1D`, `1W`, `1M`, and `ALL`.

Each bar:

```json
{
  "time": 1793836800,
  "open": 0.42,
  "high": 0.45,
  "low": 0.41,
  "close": 0.44,
  "volume": 12500.5,
  "trades": 38,
  "isComplete": true
}
```

`time` is Unix seconds at the UTC start of the bar. OHLC and volume must be finite non-negative numbers, with `high >= max(open, close)` and `low <= min(open, close)`. Volume should state whether it is base-token or quote-currency volume; `trades` is the actual count of executions, not a volume-derived estimate. Use UTC minute bars as the canonical source if the backend cannot supply every timeframe; the frontend aggregates larger bars and aligns weeks to Monday UTC and months to the first UTC day. Return ordered, deduplicated bars and define pagination/maximum range.

The real provider currently returns no bars and has no-op subscriptions. Implement an authorized venue source, preferably behind a backend adapter/proxy, and map it into this existing interface. Do not put market-provider credentials in `NEXT_PUBLIC_*` variables or expose private API secrets to the browser.

**Proposed API shape** (adapt to the chosen provider):

- `GET /api/market/vtgx/bars?from=<unix-seconds>&to=<unix-seconds>&timeframe=1m&limit=...`
- Auth-free public stream or SSE/WebSocket for current minute-bar updates, with heartbeat/reconnect semantics.
- `GET /api/market/vtgx/summary` returning `last_price`, true rolling `change_24h` (`value`, `percent`), high/low, base volume and quote volume.

The frontend currently calculates 24-hour statistics from retrieved minute bars. Prefer server-provided exchange values when available, with an explicit definition of the rolling window and quote-volume methodology. Dashboard chart shows a truthful **pre-launch / unavailable** state when there is no listing/feed; development mock values must never be represented as a real VTGX market price.

### 7.2 Benchmark feeds (optional but required for live comparisons)

The Dashboard Overview exposes benchmark choices `VTGX`, `BTCUSD`, `XAUUSD`, `SP500`, and none. The production benchmark provider currently returns no data; the development mock is explicitly development-only. If those controls are to work in production, supply historical points and subscriptions with UTC timestamps, symbol/source metadata, currency and market-session/calendar rules. Define how sparse/closed-market data is aligned with account equity. Do not interpolate a synthetic benchmark as if it were observed market data.

## 8. Pricing, subscriptions and checkout

### 8.1 Plan catalogue responses and Billing price rendering

Existing readers:

- Public pricing: `GET /api/public/plans` (no authentication).
- Billing: `GET /api/subscriptions/plans`.
- Current subscription: `GET /api/subscriptions/me`.
- Billing usage/invoices: `GET /api/subscriptions/usage`, `GET /api/subscriptions/invoices`.

Return stable plan codes and fields consumed by `Plan` (`price_monthly`, `price_yearly`, `currency`, `max_cycles`, limits/feature flags, `features`, `sort_order`). Keep the public and authenticated plan catalogue consistent. Public card descriptions/annual cycle display are partly frontend-derived; plan access and limits must be enforced from backend configuration regardless of what the client renders.

The Billing plan chooser's Monthly/Yearly toggle is a frontend state selector. For paid cards, it displays the monthly price for Monthly and `round(price_yearly / 12)` as the monthly-equivalent headline for Yearly, plus the full yearly amount as “billed yearly.” Its confirmation dialog displays the full monthly or yearly amount for the currently selected cadence. `getPlanDisplay()` multiplies the frontend `MONTHLY_CYCLES` constants by 12 for yearly entitlements; it does not calculate the displayed cycle count from a separate annual value returned by the API. Keep the catalogue and these displayed values aligned, or move display/quote values to an explicit backend plan response. Never use displayed values as the charge amount.

The Billing page currently initializes the cadence selector to Monthly even when the user's active subscription is Yearly; the backend `/api/subscriptions/me` response also omits billing cycle today. Once the API returns the persisted cycle, initialize selection from the active subscription where appropriate and make the distinction between changing plan and changing cadence explicit. Do not silently charge or change cadence merely because a user opened the chooser.

Loading and error states also need attention: the plan chooser ignores the plans/subscription `error` and can render an empty list or treat a missing subscription response as Trial (`currentCode` fallback). Billing invoice fetch errors can look like “No invoices yet.” Expose request failures distinctly from legitimate empty states and do not show a successful current-plan state until `/me` has loaded.

Subscription response must include at least:

```json
{
  "id": 123,
  "status": "active",
  "started_at": "2026-11-05T00:00:00Z",
  "current_period_end": "2026-12-05T00:00:00Z",
  "billing_cycle": "monthly",
  "cancel_at_period_end": false,
  "plan": { "code": "starter" }
}
```

Persist billing cycle in the database, not just transient metadata. Return `current_period_start` if the billing UI needs to display the active period. Define invoice states accurately (`draft/pending/paid/failed/refunded` as applicable); do not create a `paid` invoice before provider settlement.

### 8.2 Checkout payload and flow

`CheckoutForm` calls `POST /api/payments/checkout` with:

```json
{
  "plan_code": "pro",
  "billing_cycle": "yearly",
  "payment_method": "card",
  "provider": "stripe",
  "email": "customer@example.com",
  "country_code": "CD"
}
```

For Mobile Money it additionally sends `phone_number` in E.164 format, `dial_code`, ISO `country_code`, and `mobile_money_provider` (`MPESA`, `AIRTEL`, `ORANGE`, `MTN`, `AFRIMONEY`). The browser currently offers a curated set of African countries/providers. The backend must independently validate supported country/provider combinations; the current backend validates E.164/country shape and a provider-name whitelist, which is not sufficient to enforce a country/provider matrix.

Production checkout requirements:

1. Authenticate the user; derive account, plan, currency, amount, billing cycle, entitlement and taxes/fees (if applicable) server-side. Never trust a client amount.
2. Create a durable pending payment/order with an idempotency key before contacting Stripe or Flutterwave. The backend already defines a `PaymentIntent` model with provider/status/billing-cycle fields; wire the checkout route to persist and return this record instead of returning only a stub URL.
3. Use a provider-hosted checkout or provider-approved tokenized Elements flow. **Never send or store raw PAN/card number, CVC, or expiry in GenX APIs/logs/database.** The current form collects card fields only for browser-side validation and does not include them in the API payload; therefore it is not itself a working card payment integration. Prefer replacing those fields with hosted/secure provider components rather than forwarding raw card data.
4. Return a typed response such as `{ "status": "checkout_required", "payment_id": "...", "checkout_url": "https://..." }` (or a provider token for a genuinely embedded flow). The existing `/dashboard?checkout=stub...` is not a payment result.
5. Activate/change subscription, create a paid invoice and credit cycles only after a signature-verified provider webhook or server-to-server payment verification confirms settlement. Make webhook processing idempotent and safe under retries/out-of-order events.
6. Provide explicit pending, canceled, failed, and successful return states. On redirect back, the frontend should query the payment status; a browser redirect/query parameter is not proof of payment.
7. Keep payment provider secrets server-only. Add structured audit records for attempts, settlement, refunds and subscription changes, without sensitive payment data.

**Current implementation warning:** `POST /api/payments/checkout` returns a stub URL. `POST /api/subscriptions/change` currently cancels the existing subscription, creates an active replacement, sets the invoice status to `paid`, and commits without a payment-provider confirmation. Do not expose this behavior as real paid plan selection. Refactor plan changes through the payment state machine or otherwise prevent paid entitlements/invoices from being granted before settlement.

### 8.3 Billing plan selection

The billing page's “Choose Plan” confirmation calls `POST /api/subscriptions/change` with `{ "plan_code": "...", "billing_cycle": "monthly" | "yearly" }`. It displays the selected price and cycle before confirmation, and says “Billing is stubbed for now — no real charge occurs.” It does **not** redirect to `/checkout/...` or call `/api/payments/checkout`.

The current backend `change_plan` route nevertheless immediately cancels existing active subscriptions, creates an active replacement, changes `user.plan_id`, and creates an invoice with status `paid`—all without charging or verifying a provider payment. Thus the user-facing Billing flow and backend behavior contradict each other: it claims no charge, yet changes entitlements and records payment as settled. Treat this as a release-blocking correctness issue, not a fully working plan switch.

Implement a payment-gated flow instead: create a pending change/order, send the user through the approved provider flow, and only after verified settlement atomically apply the plan/cadence, term dates and cycle-bucket policy, update the invoice to paid, and refresh the UI. For unpaid/canceled/failed payment, keep the current subscription and entitlement unchanged. Return an explicit pending/checkout-required result where appropriate. Retain actionable errors and refresh `/me` and invoices only after authoritative completion. Do not silently downgrade/upgrade or discard unused purchased cycles.

The chooser's copy says the current subscription is canceled “immediately and replaced”; this must be changed to match the actual approved proration/effective-date policy. It currently does not calculate prorations or disclose any credit. Its “Confirm switch” also keeps using the currently selected cadence; ensure that price and cadence stay bound together through confirmation to avoid a stale or changed quote.

Firm XL is contact-sales only in pricing, billing selection and checkout. It should not be offered as a self-service paid checkout without a separately approved contract workflow.

## 9. Trial → Starter conversion (critical product/payment dependency)

### 9.1 Current frontend behavior and backend gap

- The public Trial row remains hidden; the Starter card is the entry point and shows `$0.00`, “Free trial with 500 cycles”, then Starter's monthly or yearly price and corresponding normal Starter allowance.
- Selecting Starter sends the user to registration (or the dashboard if already authenticated). It maps to internal plan code `trial`; the frontend does not open a normal paid Starter checkout.
- Backend registration assigns `user.plan_id` to the Trial plan. The seed currently has `max_cycles: 500` and `trial_days: null`, consistent with a **one-time cycle-limited trial**, not a 3-day trial.
- The signup form accepts general Terms/Privacy consent, but not explicit authorization for the exact recurring Starter price/cadence. No payment-method setup is done.
- No backend cycle-depletion conversion or post-trial payment method exists. The normal checkout endpoint rejects free plans.

### 9.2 Required implementation

Automatic billing after trial is impossible to implement safely in the browser. The backend/Payments provider must:

1. Define and persist a trial enrollment record (user, start time, 500-cycle grant, remaining cycles, selected post-trial cadence, consent version/text, consent timestamp, exact authorized amount/currency, provider customer/payment-method token).
2. Obtain explicit consent to the post-trial charge and cadence before activating the free allowance. General Terms acceptance is not a substitute. Explain “500 one-time cycles, then [exact Starter price/cadence]” before consent.
3. Set up a reusable/tokenized payment method with the provider. Do not save raw card details. If Mobile Money cannot support off-session recurring debits, do not promise automatic conversion on that method; require a compatible payment method or obtain an approved user action at depletion.
4. On authoritative fuel consumption reaching zero, atomically and idempotently attempt the first Starter charge and transition to Starter only after provider-confirmed success. Use a lock/transaction/unique conversion key so concurrent engine workers cannot double-charge or double-convert.
5. On successful monthly conversion, grant the Starter monthly allowance (3,840 cycles); on annual conversion, charge $490 and grant 46,080 cycles, if annual conversion is supported.
6. On failed/declined payment, do not grant paid entitlements. Apply a documented grace/retry/past-due policy; stop new trades when no valid fuel remains and preserve existing positions.
7. Notify the user before/at trial depletion and after charge outcome; provide a way to cancel/revoke future authorization consistent with law and provider rules.

### 9.3 Billing-cycle decision required

The public pricing toggle changes the “Then” price and post-trial allowance between monthly and yearly. However, the current Starter CTA maps to `trial` and does not preserve the selected cycle through registration. An earlier product direction specified monthly automatic conversion; the current public UI visibly promises yearly conversion when Yearly is selected.

**Resolve before implementation. Recommended contract:** the selected pricing cadence is the cadence explicitly authorized and persisted at trial enrollment (default Monthly); the backend must reject/require renewed consent if the amount or cadence changes before conversion. If conversion is monthly-only, update the UI copy so Yearly is not implied as the automatic post-trial charge.

## 10. Fuel API and Billing UI contract

The Fuel panel now uses real API responses only. It has no localStorage/mock balance path, no simulated successful charge, and disables balance-dependent actions when its balance request fails. It shows a retry action, action-specific confirmation, provider redirect for hosted checkout, and success only after a backend `succeeded` result and balance refresh.

### 10.1 Balance

**Required:** `GET /api/fuel/me` (authenticated).

```json
{
  "plan_cycles": 2400,
  "purchased_cycles": 1000,
  "plan_allowance": 3840,
  "currency": "USD",
  "billing_cycle": "monthly",
  "refuel_cycle_rate": null,
  "as_of": "2026-11-05T00:00:00Z"
}
```

`plan_allowance` is the authoritative allowance for the current term (monthly quota or full annual quota); `plan_cycles` and `purchased_cycles` are non-negative integers. For Firm XL, supply its negotiated **undiscounted price per cycle** or an authoritative refuel quote. If the contracted price is unavailable, the UI intentionally disables refuel instead of inventing a quote. Consider returning `refuel_quote` with exact currency, cycles, regular price, discounted amount, billing term, and quote expiry so UI math cannot drift from server billing.

### 10.2 Refuel

**Required:** `POST /api/fuel/topup` (authenticated), body:

```json
{ "pack_code": "plan_refuel" }
```

Do not accept client price or cycle quantity. Derive account, active subscription, allowance, currency, contract rate and 50%-discounted total server-side. Use a durable payment/order record and idempotency key.

### 10.3 Early renewal

**Required:** `POST /api/subscriptions/renew` (authenticated), with no client-supplied amount/quantity. Derive the active plan and current billing cycle, charge the authoritative term price, and only on settlement start the new term and add its cycle allowance. Preserve unused cycles according to the rule in §4.3.

### 10.4 Action result envelope

The Fuel UI supports the following response union for both refuel and renewal:

```json
{ "status": "succeeded" }
```

Return `succeeded` only after payment verification and the cycle/term transaction commits.

```json
{ "status": "pending", "message": "Payment is processing." }
```

For asynchronous Mobile Money authorization, return pending; no cycles or paid term are granted yet.

```json
{
  "status": "checkout_required",
  "checkout_url": "https://provider.example/checkout/..."
}
```

Use the real provider-hosted URL and an allowlisted HTTPS origin. Errors should be non-2xx with an actionable `detail` or `message`; never return success-shaped data if payment, quote, or storage failed. On return/webhook confirmation, the UI refreshes `GET /api/fuel/me`. The page revalidates on focus for asynchronous confirmation.

### 10.5 Fuel persistence and reconciliation

Add a durable ledger or equivalent transactional model for plan grants, plan-cycle consumption, purchased/refuel credits, renewals, adjustments and payment references. At minimum, ensure:

- every ledger operation has user/account, quantity, bucket, reason, timestamp, idempotency key and related subscription/payment reference;
- balance updates and payment fulfillment are atomic/idempotent;
- plan cycles and purchased cycles cannot go negative under concurrent engines/refuel callbacks;
- provider refunds/chargebacks have an explicit reversal policy;
- renewal and plan changes cannot erase purchased cycles;
- API balances reconcile against the ledger and active subscription.

## 11. API and event standards

- Use UTC RFC 3339 timestamps with an explicit timezone; Unix time for market bars is seconds as required by the chart interface.
- Use stable IDs and pagination cursors for durable histories. Do not represent a truncated in-memory WebSocket buffer as full history.
- Document event ordering, replay cursor, duplicate behavior and reconnect semantics. Include a monotonic sequence/event ID where events can arrive out of order.
- Validate all fields at the API boundary; prices, plan codes, cycle quantity, account IDs, payment status and ownership are server-derived/validated.
- Return explicit unavailable/empty/error states. Do not substitute zeros for missing values unless zero is a true measured value.
- Add rate limits, auth, audit logging, metrics and alerting for public market endpoints, private streams, payment creation, webhooks and cycle accounting.

## 12. Acceptance criteria for backend sign-off

### Live data

- [ ] Public master history returns only approved master-account data; response and live stream have matching units/currency.
- [ ] Header readout uses a correctly named/defined performance window (true rolling 24h or “Today”).
- [ ] Live master updates, reconnects and history catch-up without moving backwards or duplicating points.
- [ ] Private account feeds require valid authentication and per-account authorization; public stream never exposes customer trades/equity.
- [ ] Account snapshots/history, capital flows and trades are durable and paginated; a page reload can reconstruct state.
- [ ] Trades show accurate UTC entry and exit times, with stable trade IDs across open/close/history events.
- [ ] VTGX market bars are real, authorized data; higher timeframes aggregate consistently; no development mock enters production.
- [ ] Benchmark choices either have documented live data or remain clearly unavailable.

### Billing/payment

- [ ] Public/authenticated plan data agree; prices, quotas and feature entitlements match the approved catalogue.
- [ ] Billing shows a clear loading/error/empty state for plan, subscription and invoice requests; a failed fetch is never presented as Trial or as an empty invoice history.
- [ ] Billing monthly/yearly prices and cycle counts match the backend catalogue; selected cadence is visible and persists through confirmation/payment.
- [ ] `billing_cycle` persists and is returned for every subscription; annual cycles/term end are correct.
- [ ] No plan, invoice, fuel, or renewal is marked paid/granted before provider-confirmed settlement.
- [ ] A canceled, declined, or pending plan-change payment leaves the current plan and entitlements unchanged; only confirmed settlement applies the requested change.
- [ ] Payment amounts, plan IDs, customer IDs and cycle grants are computed server-side.
- [ ] Webhook signatures, idempotency, retries, duplicate/out-of-order notifications and refunds are tested.
- [ ] Raw card PAN/CVC never reaches GenX servers or logs; hosted/secure provider integration is documented.
- [ ] Mobile Money country/provider mapping is validated server-side; pending user authorization never grants entitlements.
- [ ] `POST /api/subscriptions/change` cannot bypass payment; current immediate activation/paid invoice behavior is removed or restricted.

### Trial and fuel

- [ ] Trial grants exactly 500 cycles once; there is no time-based expiration unless product explicitly changes the rule.
- [ ] Trial-to-Starter conversion has explicit recorded consent, selected cadence/amount, reusable payment method and cancellation semantics.
- [ ] Depletion and concurrent workers cannot double-charge or double-convert; failure follows documented retry/grace policy.
- [ ] Fuel consumption is 45 seconds per cycle of shared active engine time; concurrent connected accounts do not multiply burn.
- [ ] At zero cycles, new trades stop and open positions are not force-closed.
- [ ] Refuel adds exactly the current term allowance at 50% of that term's price; purchased cycles never expire.
- [ ] Early renewal preserves unused cycles and adds the new allowance after successful payment.
- [ ] Fuel UI reports verified API failures and never invents balances, quotes, or successful payments.

## 13. Decisions to confirm with Product before production

1. **Trial cadence:** Does conversion use the Monthly/Yearly option selected on the public pricing card? This must match the consent wording and actual charge; the current frontend does not carry the selection through signup.
2. **Payment method for automatic conversion:** Which provider/method supports secure off-session recurring charge after 500 cycles? If none supports it, change the promise to user-authorized checkout at depletion.
3. **Trial entitlement scope:** Is the one-time 500-cycle trial per user, account, organization, or payment identity? Define abuse/re-registration policy.
4. **Cycle history and retention:** How much account equity/trade/flow history must be available for `ALL`, analytics and compliance?
5. **Public master source:** Which exact master account/session(s) are safe to publish, and what precision/refresh cadence is approved?
6. **VTGX listing source:** Which venue/API is authoritative, what data license applies, and who owns uptime, stale data and correction policy?
7. **Firm XL:** How will negotiated price, billing cadence, cycle allowance and refuel rate be stored and delivered?
8. **Payment failure policy:** Retry schedule, grace period, access state, notices, refunds and chargebacks.

## 14. Suggested implementation order

1. **Payment and authorization foundation:** provider configuration, durable payment state, signed webhooks, idempotency, invoices, and prevent unpaid plan activation.
2. **Plan/subscription correctness:** persist billing cycle/period, catalogue validation, payment-gated plan changes and cancellations.
3. **Cycle ledger and trial conversion:** authoritative consumption, 500-cycle grant, explicit consent/payment setup, depletion conversion, fuel balance/refuel/renewal.
4. **Account data security and completeness:** authenticated account snapshot/history APIs, scoped WebSocket, replay cursors, durable trades/flows.
5. **Public master feed:** verify designated public account, strengthen snapshot/stream reconciliation and settle the 24-hour metric definition.
6. **VTGX and benchmark market data:** select licensed sources, implement backend proxy/adapters and connect real provider interfaces.
7. **End-to-end acceptance:** verify monthly/yearly, card/Mobile Money, payment success/failure/pending, trial depletion, duplicate webhooks, empty balances, reconnects and browser reloads.

## 15. Non-goals

This handoff does not ask the backend engineer to recreate the pricing cards, checkout layout, chart appearance, header animations, logo, or WhatsApp contact link. Those are frontend presentation. The requested backend work is to supply authoritative data, secure and durable state transitions, and payment/engine integrations that make those existing surfaces truthful and functional.
