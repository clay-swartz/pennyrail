PennyRail v46.1 — TypeScript Hotfix

BUILD ERROR FIXED
=================
lib/money-radar.ts failed because the .catch() fallback objects for the
Polymarket and Kalshi incentive scans did not include totalActiveRewardPoolUsd.

TypeScript therefore inferred a union where that property was not guaranteed.

FIX
===
The fallback objects now preserve the same required numeric shape:

Polymarket fallback:
- activePeriods: 0
- totalActiveRewardPoolUsd: 0
- shareOfCurrentPoolsNeededFor1000: null
- top: []

Kalshi fallback:
- activePrograms: 0
- totalActiveRewardPoolUsd: 0
- shareOfCurrentPoolsNeededFor1000: null
- top: []

No money logic, APIs, scoring, trading behavior, or product behavior changed.

EXACT WORKFLOW
==============
Stay on the EXISTING branch:
v46-money-radar

Upload this ZIP preserving paths.

Commit as:
Fix v46 incentive fallback typing

Keep the existing PR title:
v46: Add the $1K-per-day money radar

Wait for Vercel to rebuild.

Send:
green

or paste the next exact Vercel error.
