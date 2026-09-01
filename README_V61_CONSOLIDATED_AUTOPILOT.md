# PennyRail v61 — Consolidated Autopilot

This is intentionally one consolidated money release rather than another chain of tiny experiments.

## What it does

### 1. Persistent paper worker without Vercel Pro

Vercel Hobby can only run its native cron once per day. The daily cron now calls:

`GET /api/autopilot/bootstrap`

Bootstrap starts a 10-minute self-scheduling paper loop using the free public AI Sense delayed-webhook endpoint.

The callback URL is HMAC signed with PennyRail's existing server secret. No new account or environment variable is required if `RADAR_ADMIN_TOKEN` is already configured.

The daily Vercel cron is also the recovery mechanism. It will restart the loop if the external chain went stale.

### 2. Durable state without adding a database

The worker persists a compressed, HMAC-signed state snapshot to an unguessable ntfy topic derived from the existing server secret.

Only public market/revenue statistics are stored there. No user data, private keys, API keys, wallet secrets, or Kalshi credentials are written.

At 10-minute cadence this stays below ntfy's documented anonymous daily-message ceiling.

### 3. Persistent Kalshi paper economics

Every tick runs the existing public-data Kalshi paper model.

It accumulates:

- sample coverage
- how often the $1K/day gross snapshot gate holds
- time-weighted estimated reward accrual
- changing portfolio/capital
- persistent top markets
- drawdown
- trade/fill evidence

### 4. Fill + adverse-selection evidence

For the previous tick's hypothetical quotes, the worker reads public Kalshi trades since the last sample.

It conservatively estimates queue share using the entire displayed side depth, then models:

- possible YES fills
- possible NO fills
- paired fills
- locked paired edge
- one-sided exit at the next observed bid/last trade
- maker fee estimate
- taker fee estimate for conservative one-sided exit
- net trading P&L

This is paper evidence only. It never places an order.

### 5. $1,000/day net paper gate

Real capital remains disabled.

`liveCapitalReady` cannot become true until:

- roughly 24 hours of persistent evidence exists
- sample coverage is at least 70%
- at least 25 intervals have usable public trade evidence
- the modeled net paper run rate is at least $1,000/day
- the headline gate is present at least half the samples
- drawdown stays inside the conservative guard

Even if the gate clears, the code only reports readiness. It does not place real orders.

### 6. Actual outside-money scoreboard

Hourly, the worker scans Base USDC `Transfer` logs into the PennyRail seller wallet.

It explicitly excludes transfers from PennyRail's internal CDP buyer wallet.

The result is the thing that matters:

- approximate external USDC revenue over the latest 24 hours
- external transfer count
- unique outside payer count

It does not call internal bootstrap transfers revenue.

### 7. Parallel lanes, not x402 tunnel vision

Hourly heavy ticks also run:

- Money Radar — Kalshi, Polymarket US, cross-venue arb, x402 gaps
- existing PennyRail Money Hunter — Agent402/x402dash/the402 when usable

x402 stays alive in the background, but it no longer monopolizes the project.

## Endpoints

Daily recovery/bootstrap:

`GET /api/autopilot/bootstrap`

Signed scheduler callback (AI Sense delivers POST; GET is also accepted for diagnostics):

`POST /api/autopilot/tick?slot=...&token=...`

Private operator status:

`GET /api/autopilot/status`

The private status route uses the existing Radar admin session/token.

## No new human setup

No new API account.
No new database.
No GitHub Actions workflow.
No Vercel plan change.
No Kalshi credentials.
No real capital.

The only deployed cron remains Vercel Hobby-compatible: once per day.


## Verification completed before packaging

- Exact v61 TypeScript files and all three new Next route handlers pass strict local TypeScript checking.
- AI Sense webhook scheduler API was re-verified: no key, 5 seconds to 24 hours, JSON payload delivery by POST, one retry, 5,000 requests/IP/day. The tick route accepts POST accordingly.
- ntfy `since=latest`, 4,096-byte message ceiling and 250 anonymous messages/day were re-verified. At 10-minute cadence PennyRail writes ~144 state messages/day.
- Vercel Hobby once-per-day native cron limit was re-verified; v61 keeps only one daily native cron and uses the external delayed callback for the high-frequency loop.
- Kalshi `GET /markets/trades` public filters `ticker` + `min_ts` and unauthenticated single-market orderbook access were re-verified against current Kalshi documentation.
- The persisted state is HMAC-signed; a guessed/public ntfy message cannot be accepted as state without the PennyRail server secret.

The existing green `main` remains the dependency/build baseline. This patch changes only the seven files in this ZIP.
