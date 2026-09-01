PennyRail v44.1 — Bazaar Buyer Search Repair

WHY THIS PATCH EXISTS
=====================
The first v44 audit exposed two bugs in the audit itself:

1. Every Coinbase Bazaar query returned HTTP 200 but resourceCount=0.
   v44 sent `tools/call` as a raw stateless JSON-RPC POST and skipped the MCP
   initialize/session handshake.

2. Every unresolved Radar opportunity had intent="".
   The Revenue Engine stores the actual request text in `row.need`, but v44's
   unresolvedIntent() forgot to read that field.

This means the v44 result:
  indexed=0 / missing=9 / FIX_BAZAAR_INDEXING
was NOT yet reliable evidence that PennyRail is absent from Bazaar.

FIX
===
- Adds the official MCP TypeScript client package matching PennyRail's existing
  @modelcontextprotocol/server 2.0.0.
- Connects to Coinbase Bazaar via StreamableHTTPClientTransport.
- `connect()` performs the proper MCP initialize handshake/session handling.
- Calls the documented `search_resources` tool through the initialized client.
- Adds row.need to unresolved Radar intent extraction.
- Improves opportunity scoring using bestseller sales/buyers/ticket fields.
- Distinguishes buyer-search failure from true indexing failure.

NEW DECISION STATE
==================
If the initialized buyer search still returns no usable catalog results:
  FIX_BAZAAR_BUYER_SEARCH

If buyer search works but PennyRail is absent:
  FIX_BAZAAR_INDEXING

If PennyRail is indexed and Radar finds no supply / overpriced supply:
  BUILD_HIGHEST_VALUE_GAP

If a current winner converts:
  MULTIPLY_CURRENT_WINNERS

NO REVENUE/PRODUCT CHANGES
==========================
- No new product.
- No self-pay.
- No price change.
- No cron change.
- No Vercel setting.
- No Supabase change.
- No Bazaar wildcard.
- No the402 dependency.

EXACT GITHUB WORKFLOW
=====================
Start from:
main

Create branch:
v44-1-bazaar-buyer-search-fix

Upload this ZIP preserving paths.

Commit as:
Fix Bazaar buyer search and Radar gap intents

PR title:
v44.1: Repair Bazaar market audit

Merge into main.
Wait for Vercel Production green.

AFTER GREEN
===========
Go to:
https://pennyrail.vercel.app/r/7f2d4c

Click:
Audit revenue gaps

Copy full JSON and send it back.

Do not seed Bazaar again.
