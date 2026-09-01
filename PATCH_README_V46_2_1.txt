PennyRail v46.2.1 — TypeScript Hotfix

BUILD ERROR FIXED
=================
The corrected v46.2 scanner renamed its output fields, but the Promise.catch()
fallback objects still used the OLD v46 field names.

That caused TypeScript union errors for:
- polymarket.totalUniqueActiveRewardPoolUsd
- kalshi.totalMaxRewardUsdPerDay

FIX
===
Polymarket fallback now matches the corrected v46.2 shape:
- activeMarketPeriods: 0
- uniqueActiveProgramPeriods: 0
- totalUniqueActiveRewardPoolUsd: 0
- accountingNote
- top: []

Kalshi fallback now matches the corrected v46.2 shape:
- activePrograms: 0
- totalActivePeriodRewardUsd: 0
- totalMaxRewardUsdPerDay: 0
- theoreticalShareOfAllActiveDailyRewardsNeededFor1000: null
- accountingNote
- top: []

No market logic, accounting math, scoring, API calls, trading behavior,
prices, or PennyRail behavior changed.

EXACT WORKFLOW
==============
Stay on the EXISTING branch:
v46-2-reward-accounting

Upload this ZIP preserving paths.

Commit as:
Fix v46.2 corrected reward fallback typing

Keep the existing PR title:
v46.2: Make the money radar financially accurate

Wait for Vercel to rebuild.

Send:
green

or paste the next exact Vercel error.
