# GenX — Frontend Dashboard, Authentication, and Pricing Handoff

**Technical handoff — work status as of October 27, 2026**  
**Audience:** backend and integration engineers  
**Scope:** frontend presentation and data consumption, primarily the Dashboard, followed by authentication/account creation and Pricing.

> This document describes what the frontend displays, the client-side processing it performs, and the data contracts it expects. It does not certify the business rules actually enforced by the server. Deposit requirements, expirations, cycle entitlements, equity limits, billing amounts, account creation, and authentication behavior must be confirmed against the backend before release.

## 1. Executive summary

The GenX Dashboard is built as a dark institutional terminal with persistent navigation, account views, charts, and live-stream states. The most significant frontend work covers:

- the Dashboard shell, responsive navigation, connection status, and dedicated footer;
- the Overview and its equity/balance chart, capital-flow-adjusted returns, periods, and comparisons;
- Performance analytics and monthly returns;
- the Trades table and trade details;
- the VTGX chart and the separation between the shared provider interface, development mock, and real pre-launch source;
- an account-data interface and development-only demonstration fixtures;
- the shared login/account-creation experience and its existing API flow;
- Monthly/Yearly pricing display without changing plan IDs, Stripe price IDs, authentication logic, or billing implementation.

The visual system uses an obsidian background (`#0B0F17`), dark slate surfaces, emerald accents for active/positive states, rose/red tones for losses, and monospaced typography for quantitative values. Components favor subtle borders, terminal-like density, explicit empty/loading states, and responsive layouts. Existing Live Sessions, Mining, Audit, and Users routes remain available; their business logic is outside the analytical work described here.

The main backend integrations that remain to be confirmed or completed are:

1. Provide equity snapshots containing initial capital and account currency.
2. Send timestamped, signed deposit/withdrawal events.
3. Define how account history is loaded before a page opens; the current UI primarily accumulates messages received during the browser session.
4. Confirm that server-side limits, expirations, minimums, and charged amounts match the Pricing labels.
5. Confirm registration, email verification, terms-consent persistence, and token issuance behavior.
6. Replace the currently empty real VTGX/benchmark providers when authorized market sources are available.

## 2. Scope and non-regression boundaries

The work described here is frontend-side. Existing application routes and mechanisms remain in use. Prior requests explicitly excluded changes to:

- server business logic, authentication rules, and permissions;
- existing API routes, the database, and MT5 connections;
- plan identifiers and Stripe price IDs;
- the backend's live data-source flows.

The components adapt the presentation and consumption of those flows. When a value depends on server data that is not available, the UI should show an unavailable or waiting state rather than invent a real price or result. Demonstration data is clearly labeled and restricted to development.

## 3. Dashboard architecture

### 3.1 Shell and navigation

The shared Dashboard shell is in [`frontend/app/(dashboard)/dashboard/layout.tsx`](../frontend/app/(dashboard)/dashboard/layout.tsx). It provides:

- a dark sidebar with Overview, Performance, VTGX, Trades, Live Sessions, Mining, and Audit sections;
- a Users route shown in navigation only for admin users;
- active-link styling based on the current path;
- a collapsible desktop sidebar persisted in `localStorage` under `genx_dashboard_sidebar_collapsed`;
- mobile navigation with a sliding panel, dismiss overlay, Escape-key dismissal, and close-on-route-change behavior;
- the `[` shortcut to collapse/expand the sidebar when focus is not in an editable field;
- a “Live connection” / “Reconnecting” state and update count from `useLiveSocket`;
- a client-side session check that redirects to `/login` when a token is unavailable;
- a User/Admin role label and the existing sign-out action.

Navigation preserves the established names and routes. Presentation controls do not change server-side permissions.

The footer used by this layout is [`frontend/components/DashboardFooter.tsx`](../frontend/components/DashboardFooter.tsx). It is separate from the public-site footer and contains a single right-aligned line:

`© {current year} Vortech Markets. All Rights Reserved.`

The year is generated with `new Date().getFullYear()` rather than hard-coded.

### 3.2 Main routes and surfaces

| Route | Frontend surface | Source / notable behavior |
|---|---|---|
| `/dashboard` | Overview and account equity chart | [`frontend/components/LiveTerminal.tsx`](../frontend/components/LiveTerminal.tsx) |
| `/dashboard/performance` | KPIs and monthly heatmap | [`frontend/app/(dashboard)/dashboard/performance/page.tsx`](../frontend/app/(dashboard)/dashboard/performance/page.tsx) |
| `/dashboard/vtgx` | Token information and OHLCV chart | [`frontend/app/(dashboard)/dashboard/vtgx/page.tsx`](../frontend/app/(dashboard)/dashboard/vtgx/page.tsx) |
| `/dashboard/trades` | Filterable list and trade detail panel | [`frontend/app/(dashboard)/dashboard/trades/page.tsx`](../frontend/app/(dashboard)/dashboard/trades/page.tsx) |
| Live Sessions, Mining, Audit, and Users | Existing routes preserved in navigation | Not the focus of the analytics changes described here. |

## 4. Account data and expected WebSocket contract

### 4.1 Shared frontend account provider

The account types and provider interface are defined in [`frontend/lib/accountDataProvider.ts`](../frontend/lib/accountDataProvider.ts). An account snapshot contains:

- `initialCapital: number | null`;
- `currency: string | null`;
- `equityPoints: LiveEquity[]`;
- `trades: LiveTrade[]`;
- `capitalFlows: CapitalFlow[]`;
- `connected: boolean`;
- `isDemonstration: boolean` and an optional `fixtureId`.

The provider exposes `getSnapshot()` and `subscribe(listener)`. `selectFixture()` and `dispose()` are optional and used by the demonstration provider.

The Overview assembles the snapshot through [`frontend/lib/useAccountDataProvider.ts`](../frontend/lib/useAccountDataProvider.ts) and [`frontend/lib/accountDataProviderFactory.ts`](../frontend/lib/accountDataProviderFactory.ts). In production, the factory returns an adapter around the live snapshot. In development, it can load the demonstration provider dynamically.

### 4.2 Live WebSocket messages currently consumed

[`frontend/lib/useLiveTrades.ts`](../frontend/lib/useLiveTrades.ts) connects to the `/ws/live` WebSocket. The URL is derived from `NEXT_PUBLIC_API_BASE` (replacing `http` with `ws`); without that variable, the development URL is based on `http://localhost:8000`.

The hook currently handles the following message types:

#### `trade_open`

The frontend reads `msg.session_id`, `msg.timestamp`, and these `msg.data` properties:

- `ticket` (identifier used to find the trade when it closes);
- `strategy`, `symbol`, `action`;
- `entry_price`, `lot`, `sl`, `tp`;
- optional `regime`.

The trade is added with `status: "open"`, without an exit price or final PnL.

#### `trade_close`

The frontend finds the open trade by `msg.data.ticket`, then updates:

- `exit_price` from `msg.data.exit_price`;
- `pnl` from `msg.data.pnl`;
- `status: "closed"`;
- `exit_time` from `msg.timestamp`.

The `ticket` must remain stable between open and close events. The current implementation correlates them by ticket.

#### `equity`

The event uses `msg.session_id`, `msg.timestamp`, and in particular:

- `data.equity`;
- `data.balance`;
- `data.open_positions`;
- `data.cycle`;
- `data.initial_capital` or `data.initialCapital`;
- `data.account_currency` or `data.currency`.

Missing equity/balance/position/cycle fields currently receive display-oriented fallbacks in the hook. For an accurate account state, the backend should emit valid values rather than rely on those fallbacks.

The hook batches equity updates received over a short window (250 ms) before adding them to React state. The number of retained points is bounded by the parameter passed to the hook.

#### `capital_flow`

The Overview expects a separate event with:

- `msg.data.amount`: signed amount; deposits are positive and withdrawals are negative;
- a timestamp in `msg.timestamp`, or otherwise `msg.data.timestamp`.

The hook adds a flow only if the amount is a finite number and the timestamp is a string. Flows are bounded by the same client-side capacity passed to the hook.

### 4.3 Reconnection and connection state

The hook reconnects the WebSocket three seconds after a close, marks the connection active on open, and cancels the timer and socket on unmount. Malformed JSON messages are logged as parsing errors.

**Integration note:** the Dashboard shell uses `useLiveSocket` for its connection indicator/counter, while pages such as Overview and Trades also use `useLiveTrades`. Depending on which hooks are active, the browser may therefore open separate WebSocket connections. If the number of connections per user is constrained on the server, consider a shared client connection layer without changing the business protocol.

## 5. Overview: display and calculations

The main entry point is [`frontend/components/LiveTerminal.tsx`](../frontend/components/LiveTerminal.tsx). It assembles the account interface, equity series, benchmarks, trades, and capital flows.

### 5.1 Account state and currencies

- The currency supplied by the provider formats Overview amounts; USD is the current fallback when it is unavailable.
- Without positive initial capital, the primary value displays “No deposit yet” and the chart does not claim to measure account performance.
- Missing history is not replaced with fictional performance.
- Connection status is visible and distinguished from demonstration data.

### 5.2 Periods, modes, and chart series

The chart exposes `1H`, `1D`, `1W`, `1M`, `3M`, `YTD`, and `ALL` periods, plus currency-value and percentage modes. Its series include:

- equity;
- balance;
- the selected benchmark when a feed is available;
- trade and capital-flow markers;
- a reference line at initial capital or 0%, depending on display mode.

Points are filtered by period and sampled for rendering. In benchmark mode, returns are compared from the first relevant point in the selected period. VTGX is selected by default; BTC, Gold, S&P 500, and None are also available.

The chart uses Recharts. The equity tooltip is driven by pointer position, interpolates between neighboring observations, stays within the chart bounds, and follows the pointer with animated interpolation. [`frontend/components/SmoothFollowTooltip.tsx`](../frontend/components/SmoothFollowTooltip.tsx) provides the shared tooltip component. Resize observers, animation frames, and related listeners are cleaned up on unmount.

Trade entry/exit markers are projected onto the nearest equity point and omitted if that point is more than five minutes away. Short-period and single-point states avoid assuming that a complete data series is already available.

### 5.3 Return adjustment for deposits and withdrawals

Analytics functions are in [`frontend/lib/dashboardAnalytics.ts`](../frontend/lib/dashboardAnalytics.ts).

`calculateFlowAdjustedEquity()`:

1. sorts equity snapshots and flows by timestamp;
2. uses initial capital as the starting reference value;
3. associates signed flows occurring between two snapshots;
4. removes the net flow from the equity/balance change before calculating the period return;
5. compounds the adjusted returns to create a time-weighted series;
6. calculates cumulative return and drawdown from that series.

As a result, a deposit alone should not be represented as positive performance, and a withdrawal alone should not be represented as a loss. Consistent flow and snapshot timestamps are important.

Trade and capital-flow markers are placed at the nearest available chart observation. A trade marker is rendered only when an observation is sufficiently close to the event time.

### 5.4 Frontend-calculated KPIs

`calculateDashboardMetrics()` calculates, among other values:

| KPI | Current frontend calculation |
|---|---|
| Realized PnL | Sum of `pnl` for closed trades. |
| Win rate | Share of closed trades whose PnL is strictly positive. |
| Max drawdown | Maximum peak-to-trough decline; when initial capital is available, the Overview calculation uses flow-adjusted equity. |
| Profit factor | Gross gains / absolute gross losses; zero when there are neither gains nor losses, and `N/A` when there are gains but no losses. |
| Sharpe | Mean daily return / daily standard deviation, annualized by √252; unavailable if volatility is zero or data is insufficient. The code marks the KPI eligible after at least 30 daily returns **or** 30 closed trades, but the formula still uses daily returns. No risk-free rate is applied. |
| Calmar | Annualized return between the first and last daily observations divided by drawdown as a fraction. |
| Realized R:R | Average winning-trade gain / average absolute losing-trade loss. |
| Expectancy / trade | Average PnL across closed trades. |

Monthly returns use the last known equity point per UTC day and aggregate daily closes by month. The heatmap is rendered by [`frontend/components/MonthlyHeatmap.tsx`](../frontend/components/MonthlyHeatmap.tsx).

These metrics are frontend calculations based on data retained in the browser. They are not server accounting or an official statement. The lack of a risk-free rate, durable history, and a defined valuation policy should be considered before treating Sharpe/Calmar as contractual metrics.

## 6. Performance, Trades, and source consistency

### 6.1 Performance

[`frontend/app/(dashboard)/dashboard/performance/page.tsx`](../frontend/app/(dashboard)/dashboard/performance/page.tsx) displays KPIs and the monthly heatmap. It currently calls `useLiveTrades(1000, 1000)` and calculates metrics from the trades and equity points received.

Unlike the Overview, this page does not currently consume `useAccountDataProvider`: it does not pass initial capital or capital flows to `calculateDashboardMetrics()`. Consequently, some calculations here use raw equity snapshots instead of the Overview's flow-adjusted series. This should be harmonized if both pages are expected to show exactly consistent metrics.

The current point limits are client-state caps, not server-history guarantees: Overview passes `useLiveTrades(5000, 10000)`, Performance passes `useLiveTrades(1000, 1000)`, and Trades passes `useLiveTrades(500, 300)`. A page retaining less history cannot reconstruct a complete `ALL` period on its own.

### 6.2 Trades

[`frontend/app/(dashboard)/dashboard/trades/page.tsx`](../frontend/app/(dashboard)/dashboard/trades/page.tsx) retains up to 500 trades and filters locally by:

- ALL, OPEN, CLOSED;
- BUY and SELL;
- text search by symbol.

A details panel exposes ticket, session, strategy, entry/exit times, stop loss, and take profit. The table also displays entry/exit prices, volume/lot, PnL, and status. Trades are fed by the live stream; this component does not load historical trades.

## 7. VTGX and benchmarks

### 7.1 VTGX market chart

The market-provider interface is defined in [`frontend/lib/vtgxDatafeed.ts`](../frontend/lib/vtgxDatafeed.ts). It separates:

- typed OHLCV bars;
- `1m`, `5m`, `15m`, `1H`, `4H`, and `1D` timeframes;
- historical retrieval (`getBars`);
- subscriptions (`subscribeBars`);
- last price and 24-hour change.

The shared layer aggregates minute bars into higher timeframes, aligns timestamps to UTC boundaries, sorts/deduplicates bars, and marks whether a bar is complete. [`frontend/components/VtgxCandlestickChart.tsx`](../frontend/components/VtgxCandlestickChart.tsx) presents Candles and Line modes, volume, linear/logarithmic scale, and a crosshair with OHLCV information.

The chart's real-time path accounts for cleaning up subscriptions when the provider, timeframe, or chart type changes and on unmount. Incoming timestamps are normalized; updates are aligned and guarded against being older than the last bar in each series.

### 7.2 Real provider and development mock

- [`frontend/lib/datafeed/real/realProvider.ts`](../frontend/lib/datafeed/real/realProvider.ts) is currently a pre-launch stub: it returns empty lists and provides no real feed.
- [`frontend/lib/marketDataProviderFactory.ts`](../frontend/lib/marketDataProviderFactory.ts) dynamically imports the mock only when mock is selected and `NODE_ENV` is `development`.
- The VTGX mock is in [`frontend/lib/datafeed/mock/mockProvider.ts`](../frontend/lib/datafeed/mock/mockProvider.ts). It generates deterministic minute bars and a simulated stream for development rendering.
- The VTGX page hides the Mock preview control outside development and warns in development that the values are simulated, not a VTGX market price.
- Without real data, the UI shows pre-launch / “No listed market data” / “Available at listing” states rather than inventing a real price.

For market-data integration, the backend/datafeed team will need to provide an authorized source matching the interface, including minute history, real-time updates, timestamp conventions, corrections/revisions, and documented OHLCV semantics.

### 7.3 Benchmarks

[`frontend/lib/dashboardBenchmarkDatafeed.ts`](../frontend/lib/dashboardBenchmarkDatafeed.ts) defines the benchmark interface for `VTGX`, `BTCUSD`, `XAUUSD`, and `SP500`.

- The unavailable production provider returns an empty list and does not subscribe to a nonexistent source.
- The benchmark mock is available only in development and checks the environment before it is created.
- The control enabling the mock is development-only, and the label under the chart explicitly identifies simulated data.

There is no real benchmark-price connection in this layer yet. A future feed should define source, timezone, frequency, non-trading periods, units, and backfill/correction behavior.

## 8. Demonstration account provider

The demonstration fixture is in [`frontend/lib/datafeed/demo/demoAccountProvider.tsx`](../frontend/lib/datafeed/demo/demoAccountProvider.tsx), loaded through [`frontend/lib/accountDataProviderDevelopment.ts`](../frontend/lib/accountDataProviderDevelopment.ts).

It provides these cases:

- USD 500;
- USD 100,000;
- USD 2,500,000;
- empty account.

Non-empty fixtures generate approximately 90 days of deterministic history with equity/balance snapshots at five-minute intervals, trades, signed deposits/withdrawals, and periodic simulated updates. Values are scaled to the selected capital. The empty account has `initialCapital: null`, no snapshots, no trades, and no flows.

The UI shows a fixture selector and a “Demo data” badge. The update timer is stopped by `dispose()` and listeners are removed during cleanup.

Fixture selection is controlled by `NEXT_PUBLIC_ACCOUNT_DATA_PROVIDER` in development. The value `live` forces the live snapshot; otherwise the factory can load the demo, with an optional fixture identifier. This code must never be treated as a source of real financial data.

The account demo currently applies to the Overview, which uses `useAccountDataProvider`. Performance and Trades call `useLiveTrades` directly and are therefore not automatically switched to the same fixtures.

## 9. Authentication and account creation

### 9.1 Shared frontend experience

The routes [`frontend/app/login/page.tsx`](../frontend/app/login/page.tsx) and [`frontend/app/register/page.tsx`](../frontend/app/register/page.tsx) render the shared client component [`frontend/components/AuthPage.tsx`](../frontend/components/AuthPage.tsx), selecting login or registration mode.

The shared brand block is [`frontend/components/AuthBranding.tsx`](../frontend/components/AuthBranding.tsx). It presents the GenX mark, the “GENX ENGINE · SECURE ACCESS” badge next to the logo text, and “Powered by Vortech Markets” on the line beneath it. The form footer uses “Secure Access”.

The current form presentation includes:

- registration-only Full legal name;
- Email address on both routes;
- Master Key on both routes;
- a visual password-strength meter in registration mode;
- mandatory Terms of Service and Privacy Policy acceptance in registration mode;
- Remember Instance and Forgot Key? on login;
- links to switch between login and registration;
- error and loading states.

The logo, form labels, responsive presentation, placeholders, and strength-meter styling are frontend concerns. No authentication rule or server permission was changed by these presentation updates.

### 9.2 Registration request and follow-up login

When the user submits registration, the component first sends:

```http
POST /api/auth/register
Content-Type: application/json
```

with the following JSON body:

```json
{
  "email": "<entered email>",
  "password": "<entered Master Key>",
  "full_name": "<entered full legal name>"
}
```

The removed “Desired Execution Mandate / Account Type” field is not held in component state, read from or written to local storage, or included in the registration payload. Earlier frontend search found no other page/component consumer that needed this value.

After a successful registration response, the same handler immediately attempts login by posting URL-encoded credentials:

```http
POST /api/auth/token
Content-Type: application/x-www-form-urlencoded
```

using the submitted email as the `username` and the submitted Master Key as the password. The frontend expects `res.data.access_token`; if present, it stores the token and redirects to `/dashboard`.

**Backend behavior to confirm:** the UI copy says “We'll send you a verification link by email,” but the implemented client flow immediately requests a token after registration. Confirm whether registration is actually verified synchronously, whether the token endpoint permits an unverified account, or whether the frontend flow/copy should change. No separate verification-token route or verification-result handling is implemented in this component.

### 9.3 Login request

Login posts the same URL-encoded `username` and `password` fields to `/api/auth/token`. The frontend expects `access_token`, saves it according to the Remember Instance option, then navigates to `/dashboard`.

Errors returned by the API are surfaced using `err.response?.data?.detail` when present, then the JavaScript error message, then a generic authentication error. The form sets a loading state during the request.

### 9.4 Token and remembered-email storage

[`frontend/lib/auth.ts`](../frontend/lib/auth.ts) provides token storage and helpers:

- with Remember Instance checked, `genx_token` is stored in `localStorage` and removed from `sessionStorage`;
- when unchecked, it is stored in `sessionStorage` and removed from `localStorage`;
- `getToken()` checks local storage, then session storage;
- `clearToken()` removes both copies;
- role helpers decode token claims for frontend display/navigation decisions.

The form separately remembers the email as `genx_remembered_email` in `localStorage` when Remember Instance is enabled; it removes the remembered address when the option is not selected. This preference is client-side convenience, not server-side authentication state.

The Axios client is in [`frontend/lib/api.ts`](../frontend/lib/api.ts). It uses the configured frontend API base, enables credentials, applies a 15-second timeout, reads the stored token for authenticated requests, and logs 401 responses before rejecting the request. The precise token scheme and server validation remain backend contract details.

### 9.5 Password strength and validation

The visual strength calculation is a pure helper in [`frontend/lib/passwordStrength.ts`](../frontend/lib/passwordStrength.ts). It awards one point for each of:

1. length of at least eight characters;
2. both lowercase and uppercase letters;
3. at least one digit;
4. at least one non-alphanumeric symbol.

When a non-empty password is shorter than eight characters, the displayed level is capped at one. The UI shows four bars: one or two active bars are red and Weak, three are orange and Medium, and four are emerald and Strong. The strength text has `aria-live="polite"`. This meter is visual feedback only: it does not enforce the backend password policy.

The HTML password input remains `required`; in registration mode it also has `minLength={6}`. This is the current browser-side constraint and may differ from the actual backend password policy. The backend remains authoritative for password validation; coordinate any mismatch rather than assuming the strength score is an entitlement or security check.

### 9.6 Terms acceptance and social login

Registration requires the Terms of Service and Privacy Policy checkbox to be selected before the submit button is enabled. The links open in new tabs:

- `https://vortech.markets/terms.html`
- `https://vortech.markets/privacy-policy.html`

The checkbox is required in the browser and the button is disabled until checked. **The current registration JSON does not contain a terms-acceptance flag, policy version, or acceptance timestamp.** If the backend needs an auditable consent record, agree on the required schema and API contract; the UI checkbox alone does not persist consent server-side.

Google sign-in is currently rendered as a disabled button because it is not configured. There is no Google OAuth API flow wired in this component. Forgot Key? is a `mailto:` link to the company support contact; it does not call a password-reset API.

## 10. Pricing: source, rendering, and server/client distinction

### 10.1 Plan source and components

Plans continue to be fetched using [`frontend/lib/usePlans.ts`](../frontend/lib/usePlans.ts):

- public pricing: `GET /api/public/plans` (unauthenticated public fetcher);
- authenticated plan list: `GET /api/subscriptions/plans`;
- current subscription: `GET /api/subscriptions/me`.

The types retain fields including `id`, `code`, `price_monthly`, `price_yearly`, `max_cycles`, `cycles_expire`, `max_account_equity`, and `features`.

Cards are rendered by [`frontend/components/PricingSection.tsx`](../frontend/components/PricingSection.tsx) on the public Pricing section and [`frontend/components/PlanCard.tsx`](../frontend/components/PlanCard.tsx) in the plan-selection surface. The selector is [`frontend/components/BillingCycleToggle.tsx`](../frontend/components/BillingCycleToggle.tsx).

Plan names, descriptions, badges, unrelated feature bullets, CTAs, and plan identifiers are not renamed. Other API-provided features remain in the list; cycle/equity features from the API are filtered from each card to avoid duplicating the display labels explicitly defined by plan code.

### 10.2 Display values

The following are the values currently displayed by the frontend cards for each plan code:

| Plan | Monthly display | Monthly cycles / expiry | Yearly monthly equivalent | Annual total display | Yearly cycles / expiry | Equity display |
|---|---:|---|---:|---:|---|---|
| Trial | $0 forever | 500 cycles, no expiry | $0 forever | — | 500 cycles, no expiry | Minimum deposit $50 |
| Starter | $49/mo | 3,840 cycles · 30-day expiry | $41/mo | $488 billed yearly | 46,080 cycles · 365-day expiry | Equity range $100 – $5,000 (per account) |
| Pro | $119/mo | 9,600 cycles · 30-day expiry | $99/mo | $1,185 billed yearly | 115,200 cycles · 365-day expiry | Equity range $6,000 – $50,000 (per account) |
| Firm | $299/mo | 19,200 cycles · 30-day expiry | $248/mo | $2,978 billed yearly | 230,400 cycles · 365-day expiry | Unlimited account equity |
| Firm XL | $1,299/mo | 30,720 cycles · 30-day expiry | $1,078/mo | $12,938 billed yearly | 368,640 cycles · 365-day expiry | No equity line displayed |

The line under the price reserves a minimum height in both Monthly and Yearly views to reduce card-height changes and keep CTAs aligned. The Yearly discount badge uses light gray styling rather than orange or green.

For paid plans, the cycles sub-line and first bullet intentionally use different formats:

- Sub-line: `X cycles · N-day expiry`
- First bullet: `X cycles (N-day expiry)`

Trial shows `500 cycles` without an expiry and the bullet `500 cycles (one-time)`. It must not inherit a paid-plan expiry.

### 10.3 Annual display calculation

For paid plans, the frontend starts from `plan.price_monthly`:

```text
annualTotal = round(monthlyPrice × 12 × 0.83)
monthlyEquivalent = round(annualTotal / 12)
```

The main Yearly price is the monthly equivalent (`/mo`); the secondary line shows the total `billed yearly`. The display code does not use `plan.price_yearly` to calculate this amount. The selected `cycle` is still passed through the existing navigation/plan actions; this presentation logic does not change Stripe price IDs or the amount charged by the backend.

**Checkout alignment detail:** [`frontend/app/checkout/[planCode]/page.tsx`](../frontend/app/checkout/%5BplanCode%5D/page.tsx) currently displays its order summary using `plan.price_yearly` for Yearly and `plan.price_monthly` for Monthly. Therefore, the Yearly total shown on Pricing (derived from `price_monthly`) can differ from the Yearly amount shown in Checkout (derived from `price_yearly`). Confirm that the API values make these amounts match, or agree on which existing frontend display should be aligned. No billing API or Stripe ID was changed here.

Existing CTAs retain their destinations/behavior: Trial goes to login, Firm XL goes to Contact sales, and other plans go to the checkout route with plan and cycle. Existing billing flow and API keys are not replaced by this display layer.

### 10.4 Backend rules that must be verified

The values above are frontend presentation values. This document **does not confirm** that the backend actually enforces:

- 30- or 365-day cycle expiration;
- the displayed cycle quantities, including whether they renew, accumulate, or are one-time;
- minimum deposits or equity ranges;
- annual billing totals equal to the expected amounts in the table;
- identical rules for every currency or plan code.

The backend must remain authoritative for amounts charged, permissions and limits, expiration, minimum-deposit enforcement, and allowed equity. Compare the server behavior by `plan.code` and billing cycle before commercial activation. If server rules differ, document the discrepancy and agree how to align them; frontend text is not a security check or entitlement.

## 11. Recommended backend integration checklist

### Account and live stream

- [ ] Confirm `trade_open` and `trade_close` use the same `ticket`, expected fields, and consistent timestamps.
- [ ] Emit `equity` with `equity`, `balance`, `open_positions`, `cycle`, `session_id`, timestamp, initial capital, and currency.
- [ ] Choose one canonical field name for initial capital/currency, or explicitly maintain the aliases accepted by the frontend.
- [ ] Emit every deposit/withdrawal as `capital_flow` with a signed amount, consistent currency, and usable timestamp.
- [ ] Define ordering/rules when a flow and snapshot share a timestamp so adjusted calculations remain reproducible.
- [ ] Decide how to return data from before the WebSocket connection: these pages do not currently call a historical bootstrap endpoint.
- [ ] Define sufficient history retention for `ALL`, daily returns, and the heatmap; the current hook limits are not archival storage.
- [ ] Confirm the expected number of WebSocket connections per browser or plan for client-side connection sharing.

### Analytics

- [ ] Decide whether analytics remain frontend estimates or certified KPIs should be calculated server-side.
- [ ] Confirm business definitions for returns, external flows, drawdown, risk-free rate, and annualization.
- [ ] Harmonize Performance and Overview so initial capital and capital flows are treated consistently.
- [ ] Validate `N/A` behavior when the observation window is insufficient or variance is zero.

### Authentication and account creation

- [ ] Confirm whether registration creates an immediately usable account or requires email verification.
- [ ] Align the UI verification-link copy with actual server behavior and token issuance.
- [ ] Confirm registration accepts exactly `email`, `password`, and `full_name`, and login accepts URL-encoded `username` and `password`.
- [ ] Confirm token response shape (`access_token`) and expected authorization-header scheme.
- [ ] Confirm the backend password policy against the browser's current six-character minimum; the strength meter is not enforcement.
- [ ] Decide whether terms acceptance must be stored server-side. The current registration request sends no consent flag, policy version, or timestamp.
- [ ] Provide/configure an actual password-reset flow if Forgot Key? should do more than open an email client.
- [ ] Keep Google sign-in disabled until its OAuth flow and backend contract are implemented.

### VTGX and benchmarks

- [ ] Provide an authorized minute OHLCV history source and live channel to replace the real-provider stub.
- [ ] Document timestamps (UTC seconds), volume, incomplete bars, corrections, and duplicates.
- [ ] Confirm benchmark sources for VTGX/BTCUSD/XAUUSD/SP500 before enabling real values.
- [ ] Preserve the empty pre-launch state when no authorized real price exists.

### Pricing and billing

- [ ] Compare server cycle and monthly/yearly expiry rules with the table in section 10.
- [ ] Confirm annual billed totals match the displayed amounts, including the Checkout `price_yearly` value.
- [ ] Confirm minimum deposits, equity ranges, and Firm/Firm XL exceptions.
- [ ] Keep the server authoritative and validate the plan/cycle server-side; browser display values are not protection.
- [ ] Verify existing plan IDs and Stripe price IDs remain unchanged.

## 12. Validation history and documentation limitations

Reports from prior iterations record successful TypeScript checks, targeted analytics/datafeed tests, production builds, and browser checks at some Dashboard milestones. They also record intermediate checks that were not completed and a fixture test that failed before a final consolidated verification.

This document is a technical handoff, not a new test report. It does not claim that the complete frontend currently passes a full production build, or that account data, cycle/expiry rules, benchmarks, authentication behavior, or annual prices have been verified against the server. Test results should be tied to the corresponding commit/build before being treated as delivery evidence.

## 13. Frontend reference files

### Dashboard and account

- [`frontend/app/(dashboard)/dashboard/layout.tsx`](../frontend/app/(dashboard)/dashboard/layout.tsx) — shell, navigation, client auth guard, WebSocket status, dedicated footer.
- [`frontend/components/DashboardFooter.tsx`](../frontend/components/DashboardFooter.tsx) — Dashboard copyright with dynamic year.
- [`frontend/components/LiveTerminal.tsx`](../frontend/components/LiveTerminal.tsx) — Overview, chart, periods, benchmarks, interactions, and KPIs.
- [`frontend/lib/accountDataProvider.ts`](../frontend/lib/accountDataProvider.ts) — account provider/snapshot types.
- [`frontend/lib/accountDataProviderFactory.ts`](../frontend/lib/accountDataProviderFactory.ts) — live/demo provider selection by environment.
- [`frontend/lib/useAccountDataProvider.ts`](../frontend/lib/useAccountDataProvider.ts) — Overview provider subscription.
- [`frontend/lib/useLiveTrades.ts`](../frontend/lib/useLiveTrades.ts) — live socket and event mapping.
- [`frontend/lib/dashboardAnalytics.ts`](../frontend/lib/dashboardAnalytics.ts) — analytics, returns, chart domains, and heatmap calculations.
- [`frontend/components/SmoothFollowTooltip.tsx`](../frontend/components/SmoothFollowTooltip.tsx) — shared animated tooltip.
- [`frontend/components/MonthlyHeatmap.tsx`](../frontend/components/MonthlyHeatmap.tsx) — monthly-return display.

### Authentication and registration

- [`frontend/app/login/page.tsx`](../frontend/app/login/page.tsx) — login route wrapper.
- [`frontend/app/register/page.tsx`](../frontend/app/register/page.tsx) — registration route wrapper.
- [`frontend/components/AuthPage.tsx`](../frontend/components/AuthPage.tsx) — shared login/registration UI and API flow.
- [`frontend/components/AuthBranding.tsx`](../frontend/components/AuthBranding.tsx) — shared GenX/Vortech branding.
- [`frontend/lib/auth.ts`](../frontend/lib/auth.ts) — token storage, decoding, and role helpers.
- [`frontend/lib/api.ts`](../frontend/lib/api.ts) — Axios client and authentication request handling.
- [`frontend/lib/passwordStrength.ts`](../frontend/lib/passwordStrength.ts) — visual password-strength score.
- [`frontend/lib/useUsers.ts`](../frontend/lib/useUsers.ts) — authenticated admin user list and management API calls.

### Market data and simulated providers

- [`frontend/lib/vtgxDatafeed.ts`](../frontend/lib/vtgxDatafeed.ts) — VTGX provider contract and bar aggregation.
- [`frontend/lib/marketDataProviderFactory.ts`](../frontend/lib/marketDataProviderFactory.ts) — market provider factory.
- [`frontend/lib/datafeed/real/realProvider.ts`](../frontend/lib/datafeed/real/realProvider.ts) — pre-launch real-provider stub.
- [`frontend/lib/datafeed/mock/mockProvider.ts`](../frontend/lib/datafeed/mock/mockProvider.ts) — development-only simulated minute source.
- [`frontend/lib/dashboardBenchmarkDatafeed.ts`](../frontend/lib/dashboardBenchmarkDatafeed.ts) — benchmark contract and development mock.
- [`frontend/components/VtgxCandlestickChart.tsx`](../frontend/components/VtgxCandlestickChart.tsx) — VTGX chart, modes, and OHLCV data.
- [`frontend/components/VtgxSparkline.tsx`](../frontend/components/VtgxSparkline.tsx) — Overview 24-hour widget.
- [`frontend/lib/datafeed/demo/demoAccountProvider.tsx`](../frontend/lib/datafeed/demo/demoAccountProvider.tsx) — account fixtures and demo controls.
- [`frontend/lib/accountDataProviderDevelopment.ts`](../frontend/lib/accountDataProviderDevelopment.ts) — dynamically loaded development account-provider module.

### Pricing, checkout, and analytics pages

- [`frontend/lib/usePlans.ts`](../frontend/lib/usePlans.ts) — plan types and existing plan/subscription API calls.
- [`frontend/components/PricingSection.tsx`](../frontend/components/PricingSection.tsx) — public pricing cards and display-price calculation.
- [`frontend/components/PlanCard.tsx`](../frontend/components/PlanCard.tsx) — reusable plan card for plan-management surfaces.
- [`frontend/components/BillingCycleToggle.tsx`](../frontend/components/BillingCycleToggle.tsx) — Monthly/Yearly selector and discount badge.
- [`frontend/app/checkout/[planCode]/page.tsx`](../frontend/app/checkout/%5BplanCode%5D/page.tsx) — checkout summary and selected plan/cycle.
- [`frontend/components/CheckoutForm.tsx`](../frontend/components/CheckoutForm.tsx) — checkout form and existing billing submission call.
- [`frontend/app/(dashboard)/dashboard/performance/page.tsx`](../frontend/app/(dashboard)/dashboard/performance/page.tsx) — Performance view.
- [`frontend/app/(dashboard)/dashboard/trades/page.tsx`](../frontend/app/(dashboard)/dashboard/trades/page.tsx) — trade list and details.
- [`frontend/app/(dashboard)/dashboard/vtgx/page.tsx`](../frontend/app/(dashboard)/dashboard/vtgx/page.tsx) — VTGX chart page.
