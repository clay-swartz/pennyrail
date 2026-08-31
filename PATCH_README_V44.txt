PennyRail v44 — Radar Market Control

WHY THIS IS THE LAST DIAGNOSTIC PATCH
=====================================
The v43 Bazaar settlements succeeded, but Coinbase Bazaar indexing is not guaranteed
by settlement success alone. Current x402/CDP reports show real settles can succeed
without the resource becoming discoverable.

We need PennyRail itself to know:
- Is each Radar-built product actually visible in Coinbase Bazaar?
- At what rank?
- What competing supply does Bazaar surface?
- Which unresolved Radar gaps have NO supply?
- Which gaps are supplied but can be undercut?

v44 puts all of that into the EXISTING "Audit revenue gaps" action.
No new operator workflow.

WHAT IT DOES
============
Audit revenue gaps now combines:

A. Existing PennyRail Revenue Engine
   - paid Agent402 bestseller demand
   - unmet-demand radar
   - mapped/unmapped capability gaps
   - current market/economic data

B. Coinbase Bazaar buyer-side search
   - calls the actual Coinbase Bazaar MCP `search_resources` tool
   - checks every v42/v43 gap-arbitrage product
   - reports whether PennyRail appears and its rank
   - reports cheapest external competing price when available

C. Unresolved-gap market audit
   - takes the top 8 unresolved Revenue Engine opportunities
   - searches the active Bazaar buyer catalog
   - classifies each:
       MISSING       = no external Bazaar supply surfaced
       UNDERCUTTABLE = supply exists above $0.001 floor
       SUPPLIED      = supply exists at floor/lower
       UNKNOWN       = Bazaar query unavailable

The output contains:
bazaarMarket.productVisibility
bazaarMarket.gapArbitrage
bazaarMarket.nextAction

DECISION RULE
=============
If PennyRail products are absent:
  FIX_BAZAAR_INDEXING

If products are indexed and Radar sees MISSING / UNDERCUTTABLE gaps:
  BUILD_HIGHEST_VALUE_GAP

If products are indexed and an outside product is converting:
  MULTIPLY_CURRENT_WINNERS

No more random inventory.

IMPORTANT
=========
- No self-pay occurs in v44.
- No cron changes.
- No Vercel settings.
- No Supabase changes.
- No Bazaar wildcard.
- No price changes.
- No the402 dependency.
- No Terminal.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Branch:
v44-radar-market-control

Upload this ZIP preserving paths.

Commit as:
Make Radar audit the live Bazaar buyer market

PR title:
v44: Turn revenue audit into market control

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
Go to:
https://pennyrail.vercel.app/r/7f2d4c

Click:
Audit revenue gaps

Use "Copy full JSON" and send it back.

That one JSON will tell us whether the next move is indexing repair,
gap construction, or multiplying a current winner.
