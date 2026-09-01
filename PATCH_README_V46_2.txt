PennyRail v46.2 — Reward Accounting + Daily Economics Fix

WHY THIS IS REQUIRED
====================
The first live v46 scan was directionally useful but financially wrong:

1. Kalshi `period_reward` is CENTI-CENTS, not dollars.
   10,000,000 raw units = $1,000, not $10,000,000.

2. Polymarket US says a liquidity `rewardPool` is shared across a program's
   markets and must not be summed once per market.

The original scan's ~$5.29B headline was therefore inflated and MUST NOT be
used to justify live capital.

WHAT V46.2 DOES
===============
KALSHI
- Converts period_reward using 1 centi-cent = $0.0001.
- Computes each program's scheduled duration.
- Computes maxRewardUsdPerDayIfFullyPaid.
- Adds 1%, 5%, 10%, 25%, 50% reward-share scenarios.
- For liquidity programs, estimates the rough collateral footprint of posting
  target-size BUY liquidity on both YES and NO at current best bids.
- Adds a full-pool reward/capital ceiling.
- Clearly states that actual payout is pro-rata by snapshot score and may be
  lower when snapshots are excluded.

POLYMARKET US
- Dedupes shared program/time-period pools.
- Adds the number of markets sharing each pool.
- Adds equal-share-per-market ONLY as a rough ranking heuristic, not a payout
  promise.
- Adds rough target-size two-sided collateral at current BBO.
- Adds reward-share scenarios.

UNIFIED RANKING
- Stops ranking by raw headline reward.
- Ranks reward lanes using corrected daily reward vs estimated target capital.
- Arbitrage remains separate.

NO TRADING
==========
Still public data / paper only.
No credentials.
No orders.
No capital.
No Vercel settings.
No Supabase.
No cron change.
No PennyRail product changes.

EXACT WORKFLOW
==============
Start from:
main

Create branch:
v46-2-reward-accounting

Upload this ZIP preserving paths.

Commit as:
Correct reward units and rank daily capital efficiency

PR title:
v46.2: Make the money radar financially accurate

Merge into main.
Wait for Vercel Production green.

Then open:
https://pennyrail.vercel.app/api/money/radar

Copy the JSON and send it back.

This corrected scan determines whether the next release is:
- a Kalshi paper market-maker,
- a Polymarket paper market-maker,
- or neither because the $1K/day economics do not justify capital.
