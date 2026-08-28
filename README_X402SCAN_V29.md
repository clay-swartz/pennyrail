# PennyRail x402scan v29

Full-project build based on scale v28.

x402scan discovery fixes:
- Adds concrete input JSON-schema types and probe examples for every factory operation.
- Adds concrete examples to the three original PennyTools.
- Keeps x-payment-info and explicit 402 responses on all 50 paid operations.
- Adds output schemas for paid operations.
- Marks `/api/factory/catalog` with `security: []` so x402scan excludes the free
  catalog from paid probing.
- Does NOT change PennyRail's proven x402 payment wrappers or prices.
