PennyRail v41 — Autonomous Demand Sniper

CORE REVENUE FIX
================
PennyRail's paid unmet-demand code already exists, but Production currently has it OFF.
The code checks:

PENNYRAIL_ENABLE_DEMAND_RADAR === "1"

After this patch is green, add that one Vercel Production environment variable once.
From then on the loop is automatic.

v41 changes:
- Revenue audit cache refreshes hourly instead of every six hours.
- Vercel revenue cron runs hourly instead of daily.
- Every cron re-registers PennyRail with Agent402 for rapid crawler ingestion.
- Paid intelligence remains hard-capped at $0.01 per fresh audit:
  $0.005 unmet-demand radar + $0.005 paid bestsellers.
- At hourly refresh, maximum intelligence spend is about $0.24/day.

PRICE SNIPER
============
Existing capabilities are exposed at prices intended to win healthy-router price tie-breaks.

$0.0005:
- random
- uuid
- hash
- base64 decode
- hex decode
- exact token count
- time convert
- text stats
- DNS records
- latest EVM block

$0.001:
- FX conversion

$0.0015:
- current weather
- page/article metadata

$0.009:
- GPT-4o-mini chat

$0.018:
- live web search with sources

These are existing PennyRail capabilities, not random inventory.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Branch:
v41-autonomous-demand-sniper

Upload this ZIP preserving paths.

Commit as:
Turn PennyRail into an autonomous demand sniper

PR title:
v41: Enable automatic gap capture and price sniping

Merge into main and wait for Vercel Production green.

THEN — ONE VERCEL SETTING
=========================
Vercel project: pennyrail
Settings → Environment Variables

Add:
Name: PENNYRAIL_ENABLE_DEMAND_RADAR
Value: 1
Environment: Production

Save, then redeploy the latest Production deployment once.
Wait for Production green again.

Then on PennyRail operator page:
1. Audit revenue gaps
2. Refresh revenue

The audit should show:
agent402DemandRadar: "ok-paid"
(or "upstream-empty" only if Agent402 itself returns no current rows)
and demandRowsExtracted should no longer be blocked by "disabled-upstream-empty".

BAZAAR
======
The isolated Coinbase Bazaar architecture remains untouched.
No Bazaar wildcard is added.

IMPORTANT LIMIT
===============
v41 automatically captures and publishes unmet demand that maps to capabilities
PennyRail can already fulfill.

A truly novel repeated gap still becomes NEEDS-PRIMITIVE. That is the next builder
layer: automatically compose/build only repeated unresolved gaps with real demand or
a clear price advantage. We do not manufacture random inventory.
