PennyRail v44.2 — Bazaar REST Market Audit

WHAT THE v44.1 AUDIT PROVED
===========================
- Radar gap intents are now real/non-empty.
- Coinbase MCP search accepted requests and reported searchMethod=hybrid.
- But every normal product query still yielded zero parsed resources.
- Two long Revenue Engine descriptions exceeded Coinbase's 400-character query cap.

Instead of adding more MCP-specific parsing, v44.2 uses the x402 Bazaar REST
discovery/search endpoint defined by the x402 v2 discovery spec.

WHAT CHANGES
============
1. Replaces MCP buyer-search code with:
   GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/search

2. Adds independent catalog health:
   query=weather API
   This proves whether Bazaar is returning any buyer catalog at all.

3. Adds exact PennyRail indexing check:
   urlSubstring=pennyrail.vercel.app
   This separates "indexed" from "didn't rank for this semantic query."

4. Keeps semantic product ranking separately.

5. Shortens Revenue Engine descriptions before search.
   Example:
   "Browser render — Render a page..." -> "Browser render"
   This prevents the 400-character Coinbase rejection.

6. Removes the temporary @modelcontextprotocol/client dependency added in v44.1.

DECISION STATES
===============
FIX_BAZAAR_DISCOVERY_API
  Coinbase REST search itself returns no usable catalog.

FIX_BAZAAR_INDEXING
  Bazaar catalog works, but exact PennyRail URL visibility is zero.

BUILD_HIGHEST_VALUE_GAP
  PennyRail is indexed and Radar finds MISSING or UNDERCUTTABLE demand.

MULTIPLY_CURRENT_WINNERS
  No higher-value gap outranks current converting inventory.

NO BUSINESS LOGIC CHANGES
=========================
- No new products.
- No self-pay.
- No price changes.
- No cron.
- No Vercel settings.
- No Supabase.
- No the402.
- No wildcard Bazaar routes.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Create branch:
v44-2-bazaar-rest-audit

Upload this ZIP preserving paths.

Commit as:
Use Bazaar REST search for revenue market control

PR title:
v44.2: Make Bazaar audit authoritative

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
PennyRail operator -> Audit revenue gaps -> Copy full JSON -> send it back.

Do not seed Bazaar again.
