# PennyRail v54 — Autonomous Money Hunter

Only scoreboard: actual net revenue/day. Target: >= $1,000/day.

This release moves the hunter into PennyRail itself.

Every production cron run now:
1. refreshes PennyRail's demand-derived revenue catalog;
2. buys the current Agent402 demand-radar + bestseller feeds with hard per-purchase caps;
3. scans Agentery unmet demand;
4. activates/refreshes PennyRail's the402 services;
5. automatically evaluates and bids on live the402 requests using the existing bounded gap executor;
6. reads the402 earnings;
7. scans the lead-yield market;
8. re-registers PennyRail with Agent402 after catalog refresh so the crawler sees current inventory.

Discovery fix:
`/.well-known/x402` is now wrapped with an explicit price-bearing `tools` array. The prior manifest's bare resource URL list could force external routers to discover prices only through live probing.

Private manual trigger:
`GET /api/money/hunt` with the existing RADAR_ADMIN_TOKEN session/header runs the same hunter on demand.

No result is treated as success merely because a scanner found it. Actual payment/earnings remains the scoreboard.
