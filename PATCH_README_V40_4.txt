PennyRail v40.4 — Algorithm Metadata Saturation

REVENUE PURPOSE
---------------
Make every agent-facing machine-readable surface describe PennyRail's proven high-demand
paid capabilities with the exact vocabulary used by buyer routers.

This is not keyword spam and it does not fake traction. It aligns real capability metadata
with real buyer intents.

WHY
---
Agent402 explicitly ranks by:
1. task match
2. crawl health
3. price

x402 List's recommender scores relevance using AI-derived capability tags/summary plus
name, description and category, then quality using reliability, compliance, economics,
safety and a smaller real-traction component.

v40.3 fixed the live x402 challenge descriptions.
v40.4 closes the remaining metadata gaps.

CHANGES
-------
- Adds a focused root /openapi.json containing ONLY the high-demand front doors + free router.
  This prevents the revenue products from being buried under hundreds of generic aliases.
- Updates public/llms.txt with exact endpoints, prices and buyer vocabulary.
- Adds public/llms-full.txt for deeper machine indexing.
- Updates root SKILL.md and public/SKILL.md descriptions with exact high-demand intents.
- Does NOT change payment logic, prices, wallet, Bazaar isolation, or the dynamic router.

EXACT GITHUB WORKFLOW
---------------------
Start from:
main

Branch:
v40-4-algorithm-metadata

Upload this ZIP preserving paths.

Commit as:
Saturate PennyRail metadata for agent discovery

PR title:
v40.4: Optimize machine metadata for buyer ranking

Merge into main.
Wait for Vercel Production green.

Report back:
green

If Vercel fails, paste the exact error.

Do not make any other changes in this branch.

NEXT AFTER GREEN
----------------
No more metadata patch immediately after this one.

We then:
1. let active crawlers ingest the synchronized surfaces,
2. pursue the first unrelated settlement,
3. identify channel + product,
4. multiply the winner.

When the pending x402 List update review clears, the NEXT x402 List update should add these
new /api/agent/* endpoints and preserve a description that names the highest-demand intents.
