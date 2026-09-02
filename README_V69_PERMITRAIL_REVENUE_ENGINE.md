# PennyRail v69 — PermitRail Revenue Engine

## Objective

Turn PennyRail from a catalog waiting for machine buyers into a high-ticket, recurring data product while keeping existing money lanes alive in the background.

PermitRail continuously reads fresh public project records, normalizes them, infers the contractor trade most likely to act, maps adjacent downstream trades, scores recency/value/urgency, deduplicates records, and sells the result through three monetization surfaces:

1. **Self-serve recurring subscriptions** — Stripe Checkout at $299 / $799 / $1,499 per month.
2. **Machine-paid x402** — $1 feed requests (up to 100 signals) and $5 territory packs (up to 500 signals).
3. **RapidAPI-ready provider route** — OpenAPI import is already exposed and the provider route supports RapidAPI proxy-secret validation plus per-response `X-RapidAPI-Billing: Signals=N` usage accounting.

No customer contact enrichment or private data is purchased. PermitRail is public-record project intelligence. Dallas 311 is used only as area-level distress context and its street numbers are masked even in the normalized source record.

## Current public sources

- Fort Worth Development Permits — City ArcGIS, current permit feed.
- Arlington Issued Permits — City ArcGIS, current issued-permit feed.
- Dallas Public Works ROW Permits — City ArcGIS, current infrastructure / street-work permit feed.
- Dallas 311 — current public municipal distress signals, street number masked.

Dallas building-permit feeds previously discovered in open data are intentionally *not* represented as current because their public historical feeds are stale. The source adapter is designed to add a current Dallas building-permit source later without changing the product contract.

## Revenue routes

### Human/self-serve

`/permitrail`

Plans:

- Starter — $299/mo — one city + one trade; up to 100 signals/request.
- Growth — $799/mo — all supported DFW cities for one trade; up to 250 signals/request.
- Operator — $1,499/mo — all supported cities + trades; up to 500 signals/request.

A Stripe secret key is the only credential required to turn checkout on. Stripe webhook support is included but not required for first revenue because every subscriber feed request re-verifies the live Stripe subscription directly.

### x402

- `POST /api/permitrail/feed` — $1.00 — up to 100 signals.
- `POST /api/permitrail/territory` — $5.00 — up to 500 signals.

Both include Bazaar discovery metadata and v69 automatically schedules free registration with Agent402 and x402dash.

### RapidAPI

- Provider route: `/api/permitrail/rapid/feed`
- Importable OpenAPI: `/api/permitrail/openapi`
- Auth: `X-RapidAPI-Proxy-Secret` checked against `RAPIDAPI_PROXY_SECRET`.
- Usage header: `X-RapidAPI-Billing: Signals=N`.

The code is ready before any RapidAPI account setup is requested.

## Autonomy

`/api/autopilot/bootstrap` now also:

- ensures the PermitRail 30-minute refresh chain is running;
- schedules PermitRail x402 marketplace distribution independently of the main bootstrap time budget;
- keeps BatchRail and the existing Portfolio Engine running;
- keeps corrected Polymarket/Kalshi measurement separate from real revenue.

PermitRail source health and top opportunity counts are persisted independently so a source outage does not silently look like zero demand.

## Revenue accounting

The Portfolio Engine now scans paid Stripe invoices for PermitRail subscriptions, verifies the subscription carries `product=permitrail`, and retrieves the Stripe charge balance transaction when available so Stripe fees are recorded separately from gross outside revenue.

Only outside payments count as revenue. The earlier internal BatchRail seed remains a cost, not revenue.

## Safety / data handling

- Public records only.
- No purchased consumer contact data.
- No automated consumer outreach in this release.
- Dallas 311 street numbers are masked.
- Every project signal carries its source name/URL for verification.
- The landing page explicitly states that public records can be delayed or wrong and should be verified before acting.

## Post-deploy unlock

Do **not** add credentials before Vercel is green.

After green, the first credential worth adding is `STRIPE_SECRET_KEY` because the code is already ready and that one key directly turns on $299–$1,499/month self-serve checkout. RapidAPI is the next distribution unlock, not a prerequisite for deployment.
