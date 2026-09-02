# PennyRail v65 — Portfolio Engine / First-Dollar Release

This release keeps v64's corrected Kalshi paper measurement intact and adds a separate autonomous Portfolio Engine focused on literal outside money.

## What ships
- Persistent Portfolio Engine state + 10-minute self-scheduling, bootstrapped by the existing daily revenue cron.
- Real-money ledger built on the existing outside Base-USDC scanner, with internal/bootstrap transfers still excluded. NET is explicitly labeled as revenue after Portfolio-recorded costs until every legacy rail emits exact fulfillment-cost events.
- Explicit $1/day, $5/week and $0.05/unproven-test budget governor. No synthetic spend is generated just to create activity.
- Experiment ledger with lanes, demand source, price/cost/margin fields, actual revenue/cost/net, repeats, status and next action.
- Demand ingest from the existing Money Radar/Money Hunter plus public funded-work discovery (TaskBounty and BaseBounty).
- Multi-market distribution adapter for Gatefare. When `GATEFARE_PAT` exists it cross-lists the highest-demand EXISTING PennyRail products that have no paid upstream dependency, up to three new products per heavy tick. Paid-upstream products stay out until hard margin/cost protection is instrumented. A derived private fulfillment header lets Gatefare call the existing `runRevenueProduct()` supply without creating a second public/free copy.
- Gatefare revenue readback into Portfolio state.
- Funded-job lane that observes real paid queues and refuses to claim work unless a complete/validated solver path exists.
- Broker lane that preserves v36 broker primitives and explicitly forbids speculative upstream purchases.
- `/money` Portfolio Panel with outside revenue, known cost, actual net, spend caps, distribution state, funded-work state, Kalshi live gate and progress to $1,000/day.
- Authenticated Kalshi live adapter: RSA-PSS request signing, balance/orders/fills/fees reconciliation, V2 place/cancel, cancel-all, capital cap and kill switch.

## Kalshi remains OFF
The adapter is installed, but live orders are impossible unless ALL of these are true:
- `KALSHI_LIVE=true`
- `KALSHI_KILL_SWITCH` is not true
- `KALSHI_API_KEY_ID` is configured
- `KALSHI_PRIVATE_KEY` is configured
- `KALSHI_MAX_CAPITAL_USD` is positive

Do not configure/enable these until corrected paper economics justify it and the user explicitly authorizes live capital.

## One direct earning unlock after deploy
`GATEFARE_PAT` is the first low-friction credential worth adding. The code is already complete; adding the PAT activates automatic cross-listing of existing PennyRail paid supply. No second forward secret is needed.

Optional later: `TASKBOUNTY_API_KEY` enables authenticated bounty access/submission plumbing when the system identifies a task it can actually solve and validate. The public queue is still observed without it.
