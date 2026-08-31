PennyRail v38 — Router Distribution PATCH ONLY

Branch from current main:
  router-distribution-v38

Upload the contents of this patch to the repository root.
Changed/new files:
  package.json
  server.json
  app/api/mcp/route.ts
  .github/workflows/publish-mcp.yml
  README_ROUTER_DISTRIBUTION_V38.md

Commit:
  Launch router distribution and MCP discovery

Then PR -> merge -> wait for Vercel Production green.
ONLY AFTER Production is green:
  GitHub -> Actions -> Publish PennyRail MCP -> Run workflow

The MCP endpoint exposes FREE find + quote. Paid execution remains on the
existing x402 /api/router/execute/<tier> routes. No payment secrets are added.
