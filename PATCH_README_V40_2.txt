PennyRail v40.2 — Agent402 Active Routing Patch

REVENUE GOAL
------------
Get PennyRail's already-working $0.02 live web-search product into the exact discovery path
used by active x402 Smart Order Routers. This adds NO random inventory and preserves the
isolated Coinbase Bazaar architecture.

What changes
------------
1. /.well-known/x402 now rewrites to PennyRail's existing dynamic x402 manifest.
2. The safe isolated /api/bazaar/web-search route is explicitly included FIRST in resources.
3. The manifest adds exact buyer-intent language for:
   web search, current information, latest news, research, fresh sources.
4. Existing factory/revenue/router resources remain advertised.
5. No payment price change and no wildcard Bazaar exposure.

EXACT GITHUB WORKFLOW
---------------------
Start from:
main

Branch:
v40-2-agent402-routing

Upload this patch ZIP preserving paths.

Commit as:
Route active x402 buyers to PennyRail web search

PR title:
v40.2: Optimize PennyRail for active x402 routing

Merge into main, then wait for Vercel Production green.

Report back:
Production is green
OR paste the exact Vercel error.

Do not make any other changes in this branch.
