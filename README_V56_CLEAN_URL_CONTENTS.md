# PennyRail v56 — Clean proven URL-content demand

Fresh branch from green v54 main.

Revenue reason only:
Current x402 marketplace telemetry shows repeated paid demand for URL/page-content retrieval. This release puts PennyRail into that demonstrated job at $0.001/call.

Adds:
- POST /api/agent/url-contents
- $0.001 USDC
- up to 5 public URLs
- clean text + optional highlights
- SSRF/redirect/size guards
- explicit Agent402-compatible discovery metadata

Important compile change:
Every handler path returns exactly `NextResponse<UrlContentsResponse>`.
There is no mixed inferred JSON response union for withX402 to reject.
