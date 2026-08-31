PennyRail v38.4 — x402 verification probe compatibility

Purpose:
- x402 List verify-live selects PennyRail's cheapest Base-USDC endpoint.
- PennyRail has many endpoints tied at $0.001.
- The verifier can pay a valid x402 challenge but provide no business input.
- Previously that caused the post-payment handler to return HTTP 400.
- This patch makes the complete $0.001 submission tier deterministic and probe-safe
  when no input is supplied, while marking those responses inputDefaulted=true.

Changed files:
  app/api/tools/strip-tracking/route.ts
  app/api/tools/text-stats/route.ts
  app/api/tools/json-canonicalize/route.ts
  app/api/f/[operation]/route.ts

Suggested branch:
  x402-probe-safe-v38-4

Suggested commit:
  Make x402 verification probes deliver successfully

After Production is green:
1. Do NOT immediately pay another verification fee.
2. Open the Radar and click Check x402 List once to confirm payment-ready remains YES.
3. Then return to ChatGPT. We will decide whether to retry Verify delivery.
