PennyRail v45 — Browser Render Conversion Attack

WHY THIS RELEASE
================
v44.2 finally proved:
- Coinbase Bazaar buyer search is healthy.
- PennyRail is already indexed.
- PennyRail appears in 4/9 semantic product searches.
- The audit's FIX_BAZAAR_INDEXING conclusion was false because the exact URL
  check requested limit=100 while Coinbase caps discovery search at 20.

Radar also identified a real paid opportunity:
- Browser Render: 34 observed paid sales, 3 buyers, rising.
- Agent402 exact Browser Render: $0.02.
- Cheapest Bazaar supply surfaced by Radar: $0.005.
- PennyRail already has the implementation but was priced at $0.015.

V45 ATTACK
==========
1. Browser Render price:
   $0.015 -> $0.004

2. Buyer-facing language:
   Exact "browser render" / SPA / JavaScript / headless-browser terms are
   strengthened in the existing catalog metadata.

3. x402 service metadata:
   Browser Render now advertises:
   serviceName: PennyRail Browser Render
   tags: browser, render, markdown, web, agents

   This metadata is applied only to the existing Browser Render paid frontdoor
   and the safe explicit Bazaar whitelist route.

4. Radar truth fix:
   - exact Bazaar URL check limit 100 -> 20
   - semantic PennyRail hits also count as indexing proof

WHAT THIS DOES NOT DO
=====================
- No new product.
- No new marketplace.
- No wildcard Bazaar metadata.
- No self-seeding.
- No Vercel setting.
- No Supabase.
- No cron.
- No Terminal.
- No change to the other eight gap products.

UNIT ECONOMICS
==============
PennyRail's existing Browser Render implementation uses Jina Reader.
Jina currently permits Reader usage without a key at 20 RPM and with a free
API key at much higher RPM. At current PennyRail traffic the marginal upstream
cash cost is therefore effectively near zero. If outside volume appears, add
capacity only when the observed gross profit justifies it.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Create branch:
v45-browser-render-conversion

Upload this ZIP preserving paths.

Commit as:
Undercut browser render and improve buyer discovery

PR title:
v45: Attack proven browser render demand

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
On PennyRail operator page click once:
Publish inventory

That forces the updated OpenAPI/price into Agent402 + true402 immediately
instead of waiting for the next passive crawl.

Do NOT click Seed Coinbase Bazaar.

Then tell ChatGPT:
green + Publish inventory result
