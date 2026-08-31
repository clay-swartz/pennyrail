PennyRail v43 — Radar → Bazaar Revenue Loop

THIS IS THE ALIGNMENT RELEASE
=============================
PennyRail is the transaction rail. Radar is the edge.

v43 closes the loop without adding random inventory:
RADAR SIGNAL -> GAP/PRICE ARBITRAGE PRODUCT -> SAFE PUBLISHER -> SETTLEMENT METER.

WHAT CHANGES
============
1. OWNED RADAR SIGNALS
   /api/router/find no longer throws weak/no-match intent away.
   For weak/no-match queries PennyRail:
   - probes x402 List /best for live competing supply and price,
   - returns that market context as radarSignal,
   - best-effort persists the signal to the EXISTING optional
     pennyrail_radar_snapshots Supabase table if SUPABASE_URL and
     SUPABASE_SERVICE_ROLE_KEY are already configured.

   No Supabase setup is required for deploy. Persistence simply stays off if
   those env vars/table are not present.

2. SAFE COINBASE BAZAAR PUBLISHER
   The v42 paid-gap products receive Bazaar discovery metadata through an
   EXPLICIT FINITE WHITELIST only:
   - browser render
   - web extract
   - x402 quote inspector
   - Hacker News search
   - schema guard
   - OpenAPI payload validator
   - JSON query
   - color convert
   - naive forecast

   Dynamic factory/revenue wildcard routes remain Bazaar-disabled.

3. ONE-CLICK BOUNDED BAZAAR INDEXING BOOTSTRAP
   Existing operator button:
     Seed Coinbase Bazaar · max $0.02
   now seeds seven explicit v42 gap products in ONE click.

   Planned total self-settlement: $0.016 maximum.
   These are indexing seeds, NEVER organic revenue.

   Seeded:
   - web extract $0.005
   - x402 quote $0.002
   - Hacker News $0.005
   - OpenAPI validator $0.001
   - JSON query $0.001
   - color convert $0.001
   - naive forecast $0.001

   Existing web-search Bazaar seed is NOT repeated.
   Browser render and schema guard get Bazaar metadata but are not self-seeded.

4. MULTI-RAIL REVENUE METER
   Revenue refresh now checks:
   - Agent402 7d seller leaderboard
   - x402 List measured 30d/all-time traction floor

   The operator's existing 7d earned number remains Agent402-based so the UI
   is not mislabeled. x402 List traction is exposed under multiRail JSON and
   can still flip the first outside settlement signal.

WHY BAZAAR NOW
==============
Coinbase Bazaar search/proxy is a direct discover -> invoke -> pay path and does
not impose Agent402's prior-settlement eligibility gate.

AWS AgentCore Payments GA also exposes a curated Coinbase Bazaar MCP catalog to
transacting enterprise agents. Getting Radar-built products into Bazaar therefore
multiplies buyer surfaces without adding another bespoke integration.

NO OTHER CHANGES
================
- No Terminal.
- No new Vercel cron.
- No Vercel plan change.
- No the402 dependency.
- No Bazaar wildcard.
- No random tool inventory.
- No repeated web-search self-seeding.
- No fake organic revenue.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Branch:
v43-radar-bazaar-loop

Upload this ZIP preserving paths.

Commit as:
Connect Radar gap products to active Bazaar buyers

PR title:
v43: Close the Radar to revenue loop

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
Go to:
https://pennyrail.vercel.app/r/7f2d4c

Click ONCE:
Seed Coinbase Bazaar · max $0.02

Send the resulting JSON.

Then click:
Refresh revenue

No other manual action is required.
