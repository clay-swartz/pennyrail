# PennyRail v58 — live distribution

Revenue reason only.

1. PennyRail URL Contents now supports both GET and POST behind x402 at $0.001.
   GET makes the paid endpoint compatible with discovery systems that verify a URL by probing it directly.

2. Every Money Hunter run self-registers the URL Contents endpoint with x402dash:
   - free, no account/API key
   - live verification
   - searchable/routable through x402dash search, route and MCP surfaces

3. Agent402:
   - stops buying the brittle bestseller endpoint
   - reads public `/api/wishes` + `/api/sales` instead
   - PennyRail's own scorer handles unmet-demand matching

4. the402:
   - checks `/health` first
   - when the platform is paused for compliance review, PennyRail skips registration/payment attempts
   - automatically resumes its existing bid path if the platform returns live

5. GitHub Actions calls the production Money Hunter every hour.
   This keeps PennyRail hunting without a ChatGPT automation and without creating separate chats.
