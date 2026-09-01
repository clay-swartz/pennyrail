PennyRail v46 — MONEY RADAR

ONLY GOAL
=========
Find a credible route to >= $1,000/day of mostly-background revenue.
No brand/product work. No random inventory.

WHY THIS RELEASE
================
Research on 2026-09-01 found a much more direct payer than waiting for x402 buyers:

POLYMARKET US
- Public liquidity-incentive API.
- Current rewards page shows 139 programs / 69,717 markets.
- Examples include $10,000 programs and $25,000 liquidity rewards per MLB game.
- Liquidity rewards are proportional; current docs say there is no individual cap.
- Public earnings API documentation includes an example $1,828.62 reward on one market/day.

KALSHI
- Public /incentive_programs API.
- Liquidity rewards pay for resting orders even when unfilled.
- Current program allows reward pools up to $1,000 per market/day.
- Volume incentives also exist.

CROSS-VENUE
- Kalshi and Polymarket US both expose public market data.
- Same-event price discrepancies can be scanned before fees/risk.

X402
- 402 Index exposes a free /opportunities endpoint for missing/weak paid-API categories.
- PennyRail remains running in parallel with no additional work from the user.

WHAT V46 DOES
=============
Adds one endpoint:

GET /api/money/radar

It scans in parallel:

1. Polymarket US active incentive programs
   - reward pool
   - target size
   - discount factor
   - reward/target intensity
   - top-market BBO/spread
   - share of pool required to equal $1,000

2. Kalshi active liquidity + volume incentives
   - reward pool
   - target size
   - discount factor
   - current market bid/ask, volume, OI, liquidity for top candidates

3. Cross-venue Kalshi ↔ Polymarket US paper arbitrage
   - high-confidence title matches only
   - reports candidates with >= 1.5¢ gross edge per contract pair
   - PAPER ONLY; settlement language/depth/fees must be verified before live use

4. Kalshi market-bounty anomalies
   - obvious placeholders / broken variables in live market text
   - NEVER exploits; only flags candidates for private official reporting

5. 402 Index x402 opportunity feed
   - missing categories
   - poor coverage
   - single-provider dependencies
   - failing-service gaps

The endpoint returns a unified ranked opportunity list.

IMPORTANT
=========
This is PAPER / PUBLIC-DATA ONLY.
No credentials.
No trades.
No capital.
No new Vercel settings.
No cron change.
No Supabase.
No Terminal.
No PennyRail product changes.

This preserves the settled rule:
Do not put real capital at risk until simulated expected NET yield is repeatably positive
under conservative fill, fees, slippage and adverse-selection assumptions.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Create branch:
v46-money-radar

Upload this ZIP preserving paths.

Commit as:
Scan direct-payer reward and arbitrage opportunities

PR title:
v46: Add the $1K-per-day money radar

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
Open:
https://pennyrail.vercel.app/api/money/radar

Copy the JSON and send it to ChatGPT.

DO NOT:
- seed Bazaar
- republish inventory
- change Vercel
- add market API credentials yet
- deposit trading capital yet

The returned live reward inventory decides which worker gets built next.
