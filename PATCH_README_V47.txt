PennyRail v47 — Kalshi Paper Market Maker

ONLY GOAL
=========
Determine whether Kalshi liquidity rewards can credibly produce >= $1,000/day
before risking any real capital.

WHAT THE CORRECTED V46 SCAN FOUND
=================================
- Kalshi active-program scheduled reward ceiling: about $106.6K/day.
- $1K/day is about 0.94% of that aggregate ceiling.
- The attractive current lane is liquid 15-minute commodity markets:
  Gold / Silver / Copper / WTI / Natural Gas.
- Typical current reward: $20 per 15-minute period.
- Typical target size: 300 contracts.
- Rough full-target two-sided collateral at current bids: about $288-$299.

But V46 cannot tell us our reward SHARE because it does not inspect competing
order-book depth using Kalshi's actual liquidity scoring rules.

V47 DOES THAT.

NEW ENDPOINT
============
GET /api/money/kalshi-paper

It uses PUBLIC DATA ONLY:
- active Kalshi liquidity incentives
- market bid/ask, volume and open interest
- live full order books

It places NO orders and uses NO credentials.

SCORING MODEL
=============
Kalshi currently scores liquidity once per second:
1. Both YES and NO sides need Target Size depth.
2. Reference Price is the first price level reaching Target Size / 5.
3. Qualifying orders are weighted by size and price distance.
4. Each participant gets a normalized score share.
5. Reward pool is divided in proportion to time-period score.

V47 approximately simulates that exact logic against the live book.

For each candidate it tests hypothetical order sizes:
- 5% of target
- 10%
- 25%
- 50%
- 100%

Hypothetical orders JOIN the current best YES and NO bids. They do not cross.

FOR EACH SCENARIO IT RETURNS
============================
- whether both sides would qualify
- estimated YES score share
- estimated NO score share
- approximate reward-pool share
- estimated reward for the current program period
- continuous $/day run-rate if that exact opportunity repeated
- estimated two-sided collateral
- reward/capital for the period
- paired-fill locked spread edge before fees
- maximum one-sided directional loss

RISK FILTER
===========
The default paper portfolio uses the 25%-of-target scenario and only includes:
- spread <= $0.05
- volume24h >= 1,000 contracts
- both sides qualify now
- one-sided fill risk is not absurd relative to reward

This intentionally throws away the misleading zero-volume/wide-spread table
tennis rows that looked mathematically attractive in v46.

GATE
====
The endpoint returns:

gate.targetReachedOnCurrent25PctSnapshotRunRate
gate.paperPortfolioRunRateUsdPerDay
gate.estimatedSimultaneousCapitalUsd
gate.nextAction

If current snapshot run-rate >= $1,000/day:
  BUILD_PERSISTENT_24H_PAPER_WORKER

If it is below:
  DO_NOT_FUND_YET_KEEP_SEARCHING

EVEN IF THE SNAPSHOT IS > $1K/DAY:
NO LIVE MONEY YET.

We then need a persistent 24-hour paper worker because real rewards depend on
one-second snapshots, changing competitors, fills, fees and adverse selection.

NO OTHER CHANGES
================
- PennyRail keeps running.
- No x402 product changes.
- No Bazaar seed.
- No Publish Inventory.
- No Supabase changes.
- No cron.
- No Kalshi API key.
- No account connection.
- No deposit.
- No real trading.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Create branch:
v47-kalshi-paper-market-maker

Upload this ZIP preserving paths.

Commit as:
Model Kalshi reward share against live order books

PR title:
v47: Paper-test the $1K-per-day Kalshi path

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
Open:
https://pennyrail.vercel.app/api/money/kalshi-paper

Copy the JSON and send it back.

Do nothing else.
