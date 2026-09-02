# PennyRail v67 — Scale Gate + BatchRail

Objective: move PennyRail toward **$1,000/day NET**, not activity metrics.

## What turns on real earning now

### BatchRail bulk machine inference

Two new x402 paid routes use the existing PennyRail Base-mainnet seller rail and existing `OPENAI_API_KEY`:

- `POST /api/batch/trial` — **$0.05**, up to 100 short items
- `POST /api/batch/classify` — **$0.20**, up to 1,000 short items

The buyer supplies a label set, an optional classification instruction, and short items. PennyRail bundles the entire workload into **one bounded GPT-4o-mini call** and returns one normalized label per item.

The full route is a transaction-overhead wedge: at capacity the x402 sale price is **$0.0002/item**, while the buyer uses one payment instead of hundreds or thousands of separate machine-payment handshakes.

### Hard fulfillment economics

The route enforces:

- <=32 KB combined item text
- <=50 KB normalized model prompt
- <=4,096 completion tokens
- conservative guard pricing of **$0.30/M input + $1.20/M output** (2x the current GPT-4o-mini list rates used for telemetry)
- maximum guarded upstream cost: about **$0.020222**
- full batch sale price: **$0.20**
- minimum guarded full-batch contribution before facilitator/platform overhead: about **$0.179778**
- trial sale price: **$0.05**
- minimum guarded trial contribution: about **$0.029778**

Upstream inference is invoked only after x402 payment succeeds. There is no speculative OpenAI spend for outside requests.

### One-time Bazaar discovery activation

The existing `/api/autopilot/bootstrap` now attempts a one-time **$0.05 internal paid trial call** only when the Portfolio budget has at least $0.05 available today and this week.

The activation:

1. first proves the route returns HTTP 402 without payment;
2. uses the existing CDP Radar buyer with a hard $0.05 Base-USDC payment ceiling;
3. settles the Bazaar-declared trial route;
4. persists a seed marker so the settlement does not repeat;
5. records the $0.05 as experimental spend in the Portfolio ledger;
6. remains excluded from outside revenue because the existing revenue ledger excludes the internal Radar buyer.

If the internal buyer has insufficient Base USDC, bootstrap returns the exact buyer address and does not claim activation or revenue.

## Scale Gate

v67 adds a recurring public-data Scale Gate on every Portfolio tick.

### Polymarket US incentive scanner

Credential-free measurement uses the official public incentive program API and public order books. It records:

- active reward periods and raw reward capacity;
- conservative per-day pool capacity (short event windows are never inflated above their actual pool);
- target size;
- visible best-price competition;
- indicative target capital;
- optimistic visible-book reward-share screening bound;
- repeated midpoint movement / public paper observations.

A complete authenticated live adapter is included behind:

- `POLYMARKET_US_LIVE=false` by default
- credentials absent by default
- explicit capital cap required
- kill switch support

**No Polymarket credentials or capital should be added from this release alone.** Public screening can recommend setup later, but it cannot authorize money.

### Money Foundry

The Foundry now has a hard operating rule: low-ceiling work stays background-only. Its primary live product is BatchRail; Polymarket remains paper measurement; high-ticket product creation remains a parallel build lane.

MoltJobs / TaskBounty / BaseBounty remain listeners and may earn opportunistically, but they do not consume user setup time merely to chase single-digit-dollar work.

## Dashboard

`/money` now shows:

- real outside revenue / recorded costs / NET;
- BatchRail as the live machine-commerce product;
- Polymarket external reward capacity and paper screen;
- Foundry primary lane;
- tiny funded-work lanes as background-only;
- corrected Kalshi v64 still paper-only.

No modeled reward, internal seed payment, paper P&L, bid, listing, or opportunity pool is counted as outside revenue.

## Validation completed before ZIP

- TypeScript strict no-emit check across all changed v67 modules/routes: **PASS**
- BatchRail mocked runtime test: **PASS**
  - one upstream call per batch
  - 1,000-item batch path
  - response normalization
  - input caps
  - economic guard
- BatchRail max guarded upstream: **$0.020222**
- BatchRail guarded full contribution: **$0.179778**
- Polymarket public scanner mocked runtime test: **PASS**
  - short-period pools are capped at actual pool amount rather than falsely annualized
  - order-book competition calculations
  - live config remains disabled/unarmed by default
- static safety assertions: **PASS**
  - one-time seed cap = $0.05
  - seed spend reconciliation exists
  - MoltJobs is background-only
  - Polymarket requires explicit live flag + credentials + capital cap

## Deployment

Upload the contents of this release directory to repository root.

Branch: `v67-scale-gate-batchrail`

Commit as: `Launch PennyRail BatchRail and $1K/day Scale Gate`

PR title: `Launch PennyRail BatchRail and $1K/day Scale Gate`
