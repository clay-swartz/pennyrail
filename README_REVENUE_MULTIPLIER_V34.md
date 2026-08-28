# PennyRail Revenue Multiplier v34

Full-project build based on production v33 / merge commit `ba3e0c5cef42dccf7072d5d62d139008304eca1b`.

## Revenue objective

PennyRail's operating objective is **at least $1,000/day / $30,000/month**, with no architecture ceiling.

The product is not a fixed API catalog. It is a machine-commerce portfolio engine:

`PAID DEMAND INTEL -> SCORE -> AUTO-LIVE -> BUILD MISSING PRIMITIVES -> DISTRIBUTE -> BID -> FULFILL -> MEASURE -> MULTIPLY`

## Why v34 exists

The first v33 audit reported both `agent402Wishes: ok` and `x402List: ok`, yet produced:

- `demandAliasesLive: 0`
- `autoLive: []`
- `unresolved: []`

That was a real diagnostic failure, not an empty market. Agent402's public `/api/wishes` endpoint is now intentionally an aggregate-only beacon. It exposes totals but deliberately withholds the itemized demand-cluster text. v33 was therefore successfully fetching a source that could no longer provide the actual rows its gap engine needed.

## v34 changes

### 1. Buys the missing demand intelligence, with a hard penny-scale budget

Every six-hour Revenue Engine refresh can buy two Agent402 intelligence tools:

- Demand Radar: `$0.005` — itemized unmet-agent-demand clusters, signal type, recency and threshold proximity.
- Bestsellers: `$0.005` — actual per-tool paid sales, distinct buyers, revenue, organic diversity and trend.

The CDP buyer client enforces a Base-mainnet USDC payment ceiling in the payment-requirement selector itself. A changed upstream quote above `$0.005` is rejected before signing.

Maximum automatic intelligence spend:

- `$0.01` per audit
- four six-hour audit windows/day
- `$0.04/day`
- `$1.20/30 days`

The free `/api/wishes` source remains as an aggregate health beacon and backwards-compatible fallback, but it is no longer treated as itemized gap data.

### 2. Uses both unmet demand and proven paid demand

The audit now has two independent build queues:

- **Demand Radar:** what agents are asking for and failing to find.
- **Bestsellers:** what distinct outside wallets are demonstrably buying now.

A demand/bestseller need that maps to an existing PennyRail primitive becomes `AUTO-LIVE` and gets a demand-specific paid alias automatically.

A strong need with no reliable implementation becomes `NEEDS-PRIMITIVE` and is the next reusable build target.

This prevents a quiet or changed wish feed from making the factory blind.

### 3. Adds active outbound selling through the402

PennyRail can now register as an autonomous provider on the402, list machine-purchasable services, subscribe to real-time `request.created` events, bid automatically on requests it can fulfill, and complete winning jobs through the existing Revenue Engine.

Provider registration is the only paid setup call and is hard-capped at `$0.01` x402. Service creation, request notification subscription, API-key bids and fulfillment callbacks are free platform API operations.

PennyRail launches legitimate distinct service surfaces for:

- text transforms
- JSON utilities
- encoding/hash/validation
- URL utilities
- DNS records
- number/time utilities
- package/repository lookups
- package vulnerability checks
- VIN decoding
- FX/country/public data
- batch utilities
- a general autonomous utility router

This gives PennyRail two revenue motions:

1. **Inbound:** agents discover and directly purchase fixed-price services.
2. **Outbound:** a real-time request behaves like a reverse query; PennyRail bids only when its current execution library has a strong match.

Unverified-provider request bidding is capped to jobs with budget ceilings at or below `$25`, matching the402's current tier rules.

### 4. Makes outbound sales resilient

The webhook handles signed `request.created` and `job_dispatch` events using:

- `X-Platform-Secret`
- `X-Webhook-Timestamp`
- HMAC-SHA256 `X-Webhook-Signature`
- five-minute replay window
- constant-time signature comparison

The six-hour revenue cron also polls current the402 requests as a fallback and attempts idempotent bids on matching work, so one missed webhook does not permanently lose a sale.

### 5. Six-hour autonomous revenue loop

A GitHub Actions schedule hits `/api/revenue/cron` every six hours. Vercel's existing daily cron remains as a second wake-up path. The six-hour Data Cache means the paid intelligence layer cannot intentionally spend more than one `$0.01` audit per cache window.

If `THE402_API_KEY` is configured, the same tick also sweeps open requests for matching paid work.

### 6. Operator page now reflects actual revenue work

The hidden console now shows:

- paid Demand Radar rows extracted
- paid Bestseller rows extracted
- demand-specific revenue aliases
- `AUTO-LIVE` gaps
- `NEEDS-PRIMITIVE` build queue
- exact intelligence spend/caps
- the402 provider registration
- the402 service activation
- outbound request sweep
- the402 earnings

The already-successful x402 List submission is shown as **pending** and its submit button is removed so it cannot accidentally be charged again.

## One-time the402 activation

After v34 is merged:

1. Open the hidden PennyRail operator page.
2. Click **Register the402 provider · max $0.01** exactly once.
3. Copy the returned values into Vercel Production environment variables:
   - `THE402_PARTICIPANT_ID`
   - `THE402_API_KEY`
   - `THE402_WEBHOOK_SECRET`
4. Redeploy Production once.
5. Return to the operator page and click **Activate listings + auto-bidding**.

After that, direct catalog sales, real-time request bidding, fulfillment and the six-hour fallback sweep require no operator intervention.

## What remains unchanged

- authenticated Coinbase Base-mainnet facilitator from v30
- seller and CDP buyer wallets
- Base USDC settlement
- original 47 factory capabilities
- original 3 PennyTools
- v33 wildcard product routes and product catalog
- x402scan 51/51 successful registration
- x402 List 50/50 successful probe and pending review submission
- true402 / Agent402 origin registration routes
- permanently disabled legacy Bazaar experiment
- x402 List payment safety route (kept in code, no longer exposed as a repeat button)

## Scale principle

PennyRail does not win by having the most routes. It wins by repeatedly finding money-bearing machine demand, creating the cheapest reliable way to satisfy it, placing that capability in both inbound and outbound buying flows, and multiplying what proves it can earn.
