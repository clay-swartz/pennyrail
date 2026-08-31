PennyRail v41 CORRECTED — Autonomous Demand Sniper

WHY THIS REPLACES THE FIRST v41 ZIP
===================================
The first v41 attempted an hourly Vercel cron, which Vercel Hobby does not allow.
It also tried to quote some routes below the active Agent402 facilitator's $0.001
settlement floor.

Do NOT use the first v41 ZIP.
Use this corrected ZIP only.

AUTOMATIC SCHEDULING
====================
Vercel:
- Keeps the existing Hobby-compatible daily cron at 03:17 UTC.

GitHub Actions:
- Adds .github/workflows/pennyrail-revenue-radar.yml
- Calls PennyRail's existing /api/revenue/cron hourly at :17.
- The repository is public, so this uses standard public-repo Actions.
- No Terminal.
- No secret is required.
- No Vercel plan upgrade.

Revenue intelligence:
- Cache refreshes hourly.
- Agent402 registration is refreshed on each cron call.
- Paid intelligence remains capped at $0.01 per fresh hourly audit.
- Maximum planned intelligence spend is about $0.24/day.

DEMAND GAP LOOP
===============
The existing PennyRail Revenue Engine already knows how to:
- buy Agent402 Demand Radar,
- parse unmet searches / explicit requests,
- compare current supply,
- match a gap to an existing PennyRail capability,
- create a dynamic paid demand route automatically.

The missing Production switch is:
PENNYRAIL_ENABLE_DEMAND_RADAR=1

This corrected patch DOES NOT require editing lib/revenue-engine.ts.
After Production is green, add that existing env variable in Vercel Production
and redeploy once.

The x402 manifest now publishes up to 50 live dynamic demand aliases as featured
routing metadata, including their actual demand text, so external routers can
understand and select them instead of seeing only a generic resource URL.

PRICE / QUANTITY STRATEGY
=========================
Agent402's active settlement floor is $0.001, so the high-frequency deterministic
front doors use $0.001 rather than an invalid $0.0005.

At $0.001:
- secure random
- UUID v4/v7
- SHA-256/SHA-512/SHA-1/MD5 hash
- Base64 decode
- hex decode
- exact LLM token count
- time convert
- text stats
- DNS records
- latest EVM block
- FX conversion
- current weather
- page/article metadata

Valid undercuts above the floor:
- GPT-4o-mini chat: $0.009
- live web search + sources: $0.018

PennyRail wins floor-priced work through:
1. exact task match,
2. crawl health / latency,
3. richer result per floor-priced transaction,
4. repeated dynamic gap aliases.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Branch:
v41-autonomous-demand-sniper

If you already created that branch from the failed first ZIP but DID NOT merge it,
delete/recreate the branch from current main OR replace its contents with this corrected
patch before opening/merging the PR.

Upload this corrected ZIP preserving paths.

Commit as:
Turn PennyRail into an autonomous demand sniper

PR title:
v41: Enable automatic gap capture and price sniping

Merge into main.
Wait for Vercel Production green.

THEN VERCEL
===========
Project -> Settings -> Environment Variables

Add:
Name: PENNYRAIL_ENABLE_DEMAND_RADAR
Value: 1
Environment: Production

Save.
Redeploy latest Production deployment once.
Wait for green.

THEN PENNYRAIL OPERATOR
=======================
Go to:
https://pennyrail.vercel.app/r/7f2d4c

Click:
1. Audit revenue gaps
2. Refresh revenue

Expected source state:
agent402DemandRadar should no longer be "disabled-upstream-empty".
It should be "ok-paid" if rows are returned, or "upstream-empty" if the upstream
currently has no qualifying clusters.

DO NOT
======
- Do not use the original v41 ZIP.
- Do not add a sub-$0.001 Agent402 front door.
- Do not alter Bazaar wildcard behavior.
- Do not seed Bazaar again.
