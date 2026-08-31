PennyRail v39 — isolated Coinbase Bazaar web-search front door

Why:
- x402 List verification is now complete.
- PennyRail's previous safe-Bazaar decision disabled Bazaar on dynamic factory/revenue routes after a wildcard indexing bug.
- Coinbase Agentic.Market/Bazaar is a larger discovery surface and requires Bazaar discovery metadata on a settled CDP-facilitated route.

Safety:
- Existing factory, revenue aliases, router routes, x402scan, x402 List, MCP and payment server are untouched.
- Bazaar metadata exists only on ONE new static endpoint:
    POST /api/bazaar/web-search
- It uses an explicit x402HTTPResourceServer route map, the same isolation pattern established in Safe Bazaar v23.
- The Radar seed has a hard $0.02 Base-USDC ceiling.

Suggested branch:
  bazaar-web-search-v39

Suggested commit:
  Add isolated Coinbase Bazaar web search

After Production is green:
1. Open Radar.
2. Click "Seed Coinbase Bazaar · max $0.02" once.
3. Paste the returned JSON into ChatGPT.
4. Do NOT seed again. The next step is to verify whether Coinbase/Agentic.Market indexed the route.
