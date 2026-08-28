# PennyRail discovery v11

Fixes public seller discovery after browser/GitHub upload dropped the hidden `app/.well-known` folder.

- Moves manifest implementation to visible `app/api/x402-manifest/route.ts`.
- Rewrites `/.well-known/x402` to that route in Next config.
- Rewrites `/openapi.json` to the existing OpenAPI route.
- Adds explicit x402 price annotations and operation IDs to all three PennyTools.
- Makes seller registration verify both discovery documents before submitting to Agent402.
