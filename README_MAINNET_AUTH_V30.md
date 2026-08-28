# PennyRail mainnet auth v30

Full-project build based on production v29 / merge commit `f55042694a6fd6c721ae8c7ca08227537a77fb10`.

## What changes

- Fixes the seller-side Base-mainnet facilitator path to use Coinbase CDP's authenticated `createCdpFacilitatorClient()` when PennyRail is using the default Coinbase facilitator.
- Reuses the existing `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` already configured in Vercel.
- Leaves testnet behavior unchanged.
- Leaves an explicit custom `X402_FACILITATOR_URL` override unchanged.

## What does NOT change

- seller wallet
- buyer wallet
- Base mainnet network
- USDC settlement
- 47 factory capabilities
- 3 original PennyTools
- individual $0.001 prices
- generic Factory $0.003 price
- v29 OpenAPI / x402scan schemas and examples
- Agent402 / true402 discovery routes
- disabled Bazaar-extension stubs

## Why

x402scan's production probe found no valid x402 response across PennyRail's paid inventory. GET tools surfaced 500s and POST tools surfaced 405 fallback statuses. The mainnet seller was constructing Coinbase's hosted facilitator as an unauthenticated generic HTTP facilitator client. v30 changes only that default mainnet facilitator wiring.

## Gate before merge

1. Vercel Preview must compile successfully.
2. A protected PennyRail route must return a valid HTTP 402 payment challenge without payment.
3. After production merge, rerun x402scan origin discovery for `pennyrail.vercel.app`.

Do not re-enable the old Bazaar extension while testing this fix.
