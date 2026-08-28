# PennyRail x402 List v32

Full-project build based on production v31 / merge commit `028c0c7559f9e579515282e19f41dc5c1a844ea4`.

## Fix

- x402 List initial service submissions accept endpoint **paths only**.
- v31 incorrectly prefixed POST-only resources with `POST ` in the `endpoints` array.
- v32 sends all 50 paid resources as plain paths such as `/api/f/text.slugify`.
- Adds a local path-format validation matching x402 List's documented grammar before any paid request can occur.

## Unchanged

- $1.00 maximum submission payment ceiling
- Base USDC payment asset/network checks
- PennyRail seller and Radar buyer wallets
- 47 factory capabilities + 3 original PennyTools
- all prices and production x402 routes
- x402scan registration/discovery
- Agent402/true402 compatibility routes
- Coinbase mainnet facilitator authentication from v30

No payment is made during the preflight unless x402 List returns the expected safe challenge and the existing $1 ceiling checks pass.
