PennyRail v42 — Paid Gap Arbitrage

REVENUE THESIS
==============
Do not wait for the unmet-demand feed to have a row.
The v41 audit proves paid transactions are already happening in missing capabilities.

v42 converts observed paid gaps and easy public-data arbitrage into exact-match PennyRail
front doors.

NEW PAID FRONT DOORS
====================
$0.015 /api/agent/browser-render
- Directly targets Agent402's paid Browser render gap (~$0.02 observed ticket).
- Uses Jina Reader hosted browser rendering; client JavaScript executes.
- Optional JINA_API_KEY automatically raises upstream capacity if/when needed.
- No Jina key is required to launch.

$0.005 /api/agent/web-extract
- Cheap browser-backed page/article extraction to Markdown.
- Targets the high-volume web/enrichment lane.

$0.002 /api/agent/x402-quote
- Directly targets the paid x402 quote gap (~$0.003 observed ticket).
- Read-only probe: decodes HTTP 402 challenge metadata without paying the target.
- DNS resolution rejects local/private targets before any outbound request.

$0.005 /api/agent/hacker-news
- Targets an already-measured high-volume x402 data service selling HN search at a higher floor.
- Uses the public HN Algolia API.

$0.020 /api/agent/schema-guard
- Directly targets the new $0.05 Schema guard paid bestseller.
- Pure CPU: validate + infer + drift + normalized output.

$0.001 /api/agent/openapi-validate
- Directly targets the $0.002 OpenAPI payload validator paid gap.

$0.001 /api/agent/json-query
- Direct paid gap, facilitator floor.

$0.001 /api/agent/color-convert
- Direct paid gap, facilitator floor.

$0.001 /api/agent/forecast-naive
- Direct paid gap, facilitator floor.

WHAT THIS DOES NOT DO
=====================
- No random inventory.
- No Bazaar wildcard.
- No self-pay seeding.
- No unsafe local/private browser targets.
- No fake browser implementation.
- No attempt to build onchain SQL without a real reliable upstream.

AUTOMATION
==========
The v41 radar/bestseller loop stays unchanged.
v42 adds these exact-match resources to /.well-known/x402 and /openapi.json so active
routers can immediately rank them against existing sellers.

The existing daily Vercel Hobby cron stays unchanged.
No new cron schedule is added.

SCALING NOTE — JINA
===================
Jina Reader can launch without an API key. If browser-render/web-extract begin converting,
add JINA_API_KEY in Vercel Production to raise throughput. Do not add it preemptively unless
we need more capacity.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Branch:
v42-paid-gap-arbitrage

Upload this ZIP preserving all paths.

Commit as:
Capture proven paid gaps with cheaper agent services

PR title:
v42: Convert paid market gaps into PennyRail revenue

Merge into main.
Wait for Vercel Production green.

Then go to:
https://pennyrail.vercel.app/r/7f2d4c

Click:
1. Audit revenue gaps
2. Refresh revenue

Report:
green
and send the new audit JSON only if convenient.

NO OTHER MANUAL SETTING IS REQUIRED FOR v42.
