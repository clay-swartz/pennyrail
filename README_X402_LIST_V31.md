# PennyRail x402 List v31

Full-project build based on production v30 / merge commit `60aa8737ec0fd121199b68a6b2d23c1511d506c9`.

## What changes

- Adds an admin-only one-click submission route for x402 List at `/api/radar/register-x402-list`.
- Submits exactly 50 paid PennyRail endpoints: 47 individual factory utilities plus the 3 original PennyTools.
- Omits the free catalog and generic factory dispatcher from the 50-endpoint directory payload.
- Uses PennyRail's existing CDP-managed Radar buyer to pay x402 List's one-time free-host review fee.
- Does not store the review-contact email in GitHub; it is supplied from the private operator page at submission time.

## Payment safety

- Performs an unpaid preflight first.
- Pays only an `exact` Base-mainnet USDC challenge from x402 List's submit endpoint.
- Hard-refuses any fee above $1.00 USDC.
- Uses a dedicated x402 payment selector that refuses any requirement above $1.00 Base USDC before the wallet signs.
- A future $1.50 stacked resubmission fee therefore cannot be paid silently.

## What does NOT change

- seller wallet or buyer wallet
- Base mainnet network
- Coinbase facilitator auth from v30
- existing prices
- 47 factory capabilities
- 3 original PennyTools
- x402scan/OpenAPI discovery
- Agent402/true402 routes
- disabled Bazaar stubs
