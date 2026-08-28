# PennyRail v10 — Opportunity Radar

This build moves PennyRail from infrastructure proof to the Radar → Gap → Build loop.

## New
- `/api/radar/opportunities` — free first-pass gap radar using Agent402 wishes + free supply checks.
- `/api/radar/register` — submits the public PennyRail x402 origin to Agent402's open index when `X402_MODE=mainnet`.
- New dashboard focused on BUILD / WATCH / IGNORE opportunities.
- Infrastructure diagnostics moved behind a details panel.

## Go-live order
1. In Vercel, change `X402_MODE` from `testnet` to `mainnet`.
2. Redeploy Production.
3. Open the permanent Production URL.
4. Enter `RADAR_ADMIN_TOKEN`.
5. Click **List PennyRail**.
6. Click **Scan live gaps**.

The buyer wallet does NOT need funding for steps 1–6. External buyers pay the seller address directly.
Paid Demand Radar + Bestsellers remain optional until the buyer wallet is funded with Base mainnet USDC.
