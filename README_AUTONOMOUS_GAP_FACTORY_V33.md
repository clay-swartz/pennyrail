# PennyRail Autonomous Gap Factory v33

Full-project build based on production v32 / merge commit `ebee9ce35c0825d71265669f196c515c133de15f`.

## Revenue objective

PennyRail is no longer optimized around adding isolated utilities or collecting marketplace badges. The operating objective is to compound a large portfolio of tiny paid machine transactions:

`SCAN -> SCORE -> AUTO-LIVE -> PUBLISH -> MEASURE -> EXPAND`

The intended scale is portfolio revenue in the tens of thousands of dollars per month and beyond. There is no revenue ceiling in the architecture.

## What v33 adds

### 1. Daily autonomous market audit

A Vercel Cron job hits `/api/revenue/cron` once per day (compatible with the Hobby-plan daily cron limit).

The cached audit combines:
- Agent402's free aggregate demand/wishes feed: what agents asked for or failed to find.
- x402 List's live payment-ready service inventory and measured 30-day traction: supply, prices, buyers, transactions and settlement volume.

The automatic scan spends **$0**. Paid intelligence is deliberately not put on a recurring wallet charge in v33.

### 2. Gap scoring

Demand clusters are scored using:
- signal count;
- explicit-request vs discoverability intent;
- near-threshold strength;
- recency;
- estimated competing supply;
- whether PennyRail can fulfill the need immediately.

Every opportunity becomes one of:
- `AUTO-LIVE` — a real paid product is exposed immediately;
- `DISCOVERY` — PennyRail already has the capability but the issue looks like findability;
- `NEEDS-PRIMITIVE` — demand exists but the current execution library cannot reliably fulfill it yet;
- `IGNORE`.

### 3. Virtual paid-product factory

PennyRail now has tiered wildcard product routes instead of needing a deployment for every new demand phrase:

- `/api/p/nano/:slug` — $0.001
- `/api/p/network/:slug` — $0.003
- `/api/p/micro/:slug` — $0.004
- `/api/p/standard/:slug` — $0.01

All 47 existing factory capabilities automatically receive multiple machine-search aliases from their titles and keywords. When a live Agent402 demand cluster maps to a supported capability, a demand-specific alias becomes live without another GitHub/Vercel deployment.

### 4. First demand-led product templates

v33 adds several reusable execution primitives to the Revenue Engine rather than bloating the legacy 47-tool factory:

- VIN decoding via NHTSA vPIC (`vehicle.vin-decode`, $0.004). VIN decode is a demonstrated paid-agent use case in Agent402's bestseller data.
- Package vulnerability lookup via OSV (`security.osv-package`, $0.004).
- Multi-type DNS lookup via Cloudflare DNS-over-HTTPS (`dns.records`, $0.003).
- Batch execution of up to 10 PennyRail utilities in one call (`batch.utility`, $0.01).

These templates also have multiple aliases, so one implementation can occupy many natural-language demand surfaces.

### 5. Auto-publishing discovery surface

`/openapi.json` and `/.well-known/x402` now publish the Revenue Engine product routes in addition to the original 50 paid endpoints. They consume the daily cached market audit, so demand aliases can appear in machine discovery without a code deployment.

`GET /api/revenue/catalog?q=<need>` is a free machine-facing search endpoint that returns the best current paid PennyRail product paths, prices, examples and demand metadata.

### 6. Operator yield view

The hidden operator page adds a **REVENUE ENGINE · AUTONOMOUS GAP FACTORY** section showing:
- revenue routes live;
- demand aliases live;
- currently auto-live gaps;
- unresolved high-scoring gaps;
- x402 market volume / transaction / buyer observations;
- category economics.

## What remains unchanged

- v30 authenticated Coinbase mainnet facilitator fix;
- seller and buyer wallets;
- Base USDC settlement;
- original 47 factory capabilities;
- original 3 PennyTools;
- original 50 x402 List submission endpoints;
- x402scan registration;
- true402 / Agent402 registration routes;
- disabled legacy Bazaar experiment;
- x402 List $1 submission safety logic.

## Important economics

v33 intentionally uses cheap deterministic inventory as a portfolio layer, not as the entire business. The auditor's unresolved queue is the input for adding new reusable primitives that can unlock whole clusters of paid needs. One new primitive should create many product aliases and many potential transactions.

No claim is made that v33 alone guarantees a particular revenue level. It changes PennyRail from a manually expanded API list into an autonomous demand-audit + virtual-product system whose explicit optimization target is aggregate transaction yield.
