PennyRail v40.3 — Demand Front Doors

WHY THIS IS REVENUE WORK
------------------------
Active x402 routers rank by task match, health and price.

PennyRail's dynamic paid endpoints currently return generic x402 descriptions:
- factory: "Run one PennyRail machine utility."
- revenue aliases: "PennyRail demand-aligned deterministic micro-product."

That means a buyer asking for "sha256", "base64 decode", "currency conversion",
"token count", etc. cannot reliably match PennyRail even though PennyRail already
owns those capabilities.

This patch DOES NOT add random inventory.
It creates exact-match paid acquisition front doors over existing PennyRail capabilities
in lanes agents already buy.

NEW FRONT DOORS
---------------
$0.001 /api/agent/hash
$0.001 /api/agent/base64-decode
$0.001 /api/agent/hex-decode
$0.001 /api/agent/fx-convert
$0.001 /api/agent/token-count
$0.002 /api/agent/page-metadata
$0.020 /api/agent/chat-mini
$0.001 /api/agent/block-number

Existing isolated Bazaar web search remains unchanged at $0.02.

SAFE ARCHITECTURE
-----------------
- No Bazaar wildcard.
- No additional Bazaar discovery routes.
- No change to existing dynamic factory/revenue routes.
- Front doors are explicit static routes only.
- Probe-safe fallback inputs preserve crawl health.
- Existing payment stack and payTo remain unchanged.

EXACT GITHUB WORKFLOW
---------------------
Start from:
main

Branch:
v40-3-demand-frontdoors

Upload this ZIP preserving paths.

Commit as:
Expose high-demand PennyRail capabilities to active buyers

PR title:
v40.3: Add high-demand x402 buyer front doors

Merge into main.
Wait for Vercel Production green.

Report back:
green

If Vercel fails, paste the exact error.

Do not make any other changes in this branch.
