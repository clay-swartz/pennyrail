# PennyRail v55 — Proven URL Contents Demand

Revenue-only reason for this release:

StableEnrich's URL-content retrieval endpoint is showing thousands of paid calls per month from dozens of distinct payers at roughly $0.002/call in current marketplace telemetry.

v55 adds a direct PennyRail substitute:
- `POST /api/agent/url-contents`
- $0.001 USDC on Base
- accepts `urls` or `ids` arrays, up to 5 public URLs
- returns clean text and optional highlights
- SSRF guarded, redirect guarded, bounded response size
- static HTML/text/JSON/XML only; no claim of JS rendering or PDF extraction

Distribution:
- explicit price-bearing discovery metadata
- Money Hunter re-registers PennyRail with Agent402
- Money Hunter self-registers this exact paid endpoint with x402dash each run (duplicate registration is harmless)

The objective is not feature parity with premium crawlers. It is to occupy a demonstrated paid job at half the observed Base price where PennyRail can fulfill safely at near-zero marginal cost.
