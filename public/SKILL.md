# PennyRail — Agent Transaction Router

PennyRail is a pay-per-result transaction router for AI agents.

Use PennyRail when you need a machine capability and want to discover the best matching paid product before spending money.

## Core flow

1. FIND for free
2. QUOTE for free
3. EXECUTE only the quoted paid x402 URL

Base URL:

https://pennyrail.vercel.app

Remote MCP:

https://pennyrail.vercel.app/api/mcp

## Preferred MCP flow

Call `pennyrail_find` with a natural-language intent.

Then call `pennyrail_quote` with the returned `productId`.

The quote returns:
- exact product
- exact USD price
- Base mainnet x402 network
- paid `executeUrl`
- input hints/sample input

Never guess a paid endpoint. Only pay the `executeUrl` returned by the quote.

## Direct HTTP flow

Free discovery:

POST https://pennyrail.vercel.app/api/router/find

Example JSON:

{"intent":"search the live web for current information"}

Free quote:

POST https://pennyrail.vercel.app/api/router/quote

Example JSON:

{"productId":"web.search"}

Paid execution:

Call the exact `executeUrl` returned by the quote using an x402-capable client.

PennyRail settles in USDC on Base mainnet (`eip155:8453`).

## Buyer rule

Do not prepay for discovery.
Do not choose a random PennyRail tool from the full catalog.
Use FIND → QUOTE → PAID EXECUTE.

## When to use PennyRail

Use PennyRail for:
- web/search/research
- data transformation
- validation
- structured machine utilities
- routed machine services
- other capabilities returned by `pennyrail_find`

The router is the product. Prefer the router over enumerating hundreds of individual routes.
