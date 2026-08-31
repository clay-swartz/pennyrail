# PennyRail v38 — Router Distribution

Revenue-first distribution build.

- Adds a public Streamable HTTP MCP server at `/api/mcp` using the official MCP TypeScript server SDK.
- Exposes two free MCP tools: `pennyrail_find` and `pennyrail_quote`.
- Quotes return absolute x402 paid execution URLs, exact price, network, and currency. MCP discovery itself remains free.
- Adds `server.json` for the Official MCP Registry.
- Adds a manual GitHub Actions publisher using GitHub OIDC; no registry secret needs to be stored.
- Existing AgentCash-compatible OpenAPI discovery remains canonical at `/openapi.json`; the v37 x402scan 411/411 registration already exposes those paid resources to AgentCash-compatible discovery.

After merge + Vercel green, run GitHub Actions → **Publish PennyRail MCP** → **Run workflow** once.
