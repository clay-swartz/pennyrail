# PennyRail Proven Demand Multiplier v35

Based on production v34 / merge commit `f42f60875224336e814c6df01296b88dc189ca5c`.

## Why this build exists

The first v34 paid audit produced a useful bestseller feed (50 rows) but also exposed two problems that must be fixed before autonomous scaling:

1. The paid Agent402 Demand Radar returned aggregate totals but zero itemized rows (`totalWishes=3969`, `distinctClusters=1041`, `matchedClusters=0`). Continuing to buy that empty upstream response four times per day wastes money.
2. The fuzzy matcher incorrectly auto-mapped `address-label` and `mime` to PennyRail's DNS product. A revenue factory must never publish a paid alias unless the implementation actually satisfies the proven need.

v35 therefore optimizes for **safe proven-demand coverage**, not route count for its own sake.

## Changes

### Exact bestseller matching

Paid bestseller rows are no longer sent through the weak lexical matcher. A bestseller becomes `AUTO-LIVE` only when its slug has an explicit mapping to a known PennyRail equivalent. This prevents semantic false positives from being sold to buyers.

### 20 proven-demand primitives

v35 adds reusable implementations for paid shapes observed in the first bestseller audit:

- secure random bytes / integers
- UUID v4 / v7 generation
- SHA-256 / SHA-512 / SHA-1 / MD5 hashing
- MIME lookup
- epoch / ISO / timezone conversion
- Base32
- Base58
- HTML entities
- ROT13
- Roman numerals
- lorem ipsum
- text stats
- latest EVM block number
- EVM chain info
- curated EVM address labels
- current weather (Open-Meteo)
- x402 seller momentum from x402 List traction
- locale brief (country + local time + holidays + working days)
- OpenAPI operation search
- OpenAPI mock response generation
- JWT decode / HMAC verification toolkit

These use the existing wildcard paid-product routes; no route-per-product deployment is needed.

### Paid-intelligence spend discipline

Agent402 Bestsellers remains enabled because it returned real paid demand. Demand Radar is disabled by default until its upstream begins returning itemized radar rows again. It can be re-enabled later with `PENNYRAIL_ENABLE_DEMAND_RADAR=1`.

Default paid intelligence spend therefore falls to at most:

- `$0.005` per six-hour audit
- `$0.02/day`
- about `$0.60/30 days`

### Portfolio truth metric

The operator audit now reports `provenBestsellerMapped / provenBestsellerRows` and a coverage percentage. The optimization target is to increase this coverage by adding reusable profitable primitives while keeping matching exact enough that no buyer pays for the wrong implementation.

## Revenue objective

The operating target remains at least `$1,000/day` / `$30,000/month`. This is an objective, not a guarantee. The strategy is to keep converting demonstrated paid demand into reusable products while adding active distribution/bidding channels.
