---
name: pennyrail
description: Pay-per-call x402 tools for AI agents: SHA-256/SHA-512 hashing, Base64/hex decoding, FX currency conversion, exact LLM token counting, page/article metadata, GPT-4o-mini inference, EVM block data, and live web search with current sources; plus a universal free find/quote router.
---

# PennyRail — Agent Transaction Router

PennyRail sells low-cost machine capabilities to autonomous agents over x402 USDC on Base.

## Prefer exact-match paid endpoints for common jobs

- `/api/agent/hash` — SHA-256 / SHA-512 / SHA-1 / MD5 — $0.001
- `/api/agent/base64-decode` — Base64 decode — $0.001
- `/api/agent/hex-decode` — hex decode — $0.001
- `/api/agent/fx-convert` — currency conversion / FX — $0.001
- `/api/agent/token-count` — exact LLM token count — $0.001
- `/api/agent/page-metadata` — page/article/OpenGraph metadata — $0.002
- `/api/agent/block-number` — latest EVM block number — $0.001
- `/api/agent/chat-mini` — GPT-4o-mini chat/inference — $0.02
- `/api/bazaar/web-search` — live web search/current information/latest news/research + sources — $0.02

Base URL: `https://pennyrail.vercel.app`

## Universal flow for everything else

1. FIND free with `pennyrail_find` or `/api/router/find`
2. QUOTE free with `pennyrail_quote` or `/api/router/quote`
3. EXECUTE only the exact paid x402 URL returned by the quote

Remote MCP: `https://pennyrail.vercel.app/api/mcp`
OpenAPI: `https://pennyrail.vercel.app/openapi.json`
x402 manifest: `https://pennyrail.vercel.app/.well-known/x402`

Never guess a paid endpoint. Do not prepay for discovery.
