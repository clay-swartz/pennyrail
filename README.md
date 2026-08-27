# PennyRail MVP

Goal: prove one unknown machine can discover a PennyTool, pay real money via x402, and receive the result.

## What is included
- Private Radar dashboard (`/`)
- Free Agent402 market/index pull (`/api/radar/market`)
- Paid Agent402 Demand Radar + Bestsellers pull (`/api/radar/paid`) — expected spend $0.01 per refresh
- 3 sacrificial PennyTools at $0.001/call
- x402 seller integration using the current v2 Next.js pattern (`withX402`)
- machine-readable OpenAPI and `.well-known/x402` surfaces

## First deployment sequence
1. Create a new GitHub repo named `pennyrail`.
2. Upload the contents of this folder to the repo root.
3. Deploy to Vercel.
4. Add `PENNYRAIL_PAY_TO` using a dedicated Base-compatible receiving wallet address.
5. Keep `X402_MODE=testnet` initially.
6. Set `RADAR_ADMIN_TOKEN` to a long random value.
7. Create a **separate, low-balance buyer wallet** for Radar intelligence and add its private key as `RADAR_BUYER_PRIVATE_KEY`. Never use the receiving wallet's private key here.
8. Test the three tools on Base Sepolia.
9. Switch `X402_MODE=mainnet` only after testnet works and fund the buyer wallet with a small amount of Base USDC.
10. Register the deployed origin with Agent402 (`POST /api/index/register` on agent402.tools) or use its seller registration page. Agent402 says listing is free.

## Why the first tools are boring
They are sacrificial canaries. We are testing discovery + payment + settlement. Radar should choose the next tools from actual unmet demand rather than our guesses.

## Phase 2
- persist Radar snapshots in Supabase
- compute opportunity score = demand + recency + weak competition + poor incumbent health + price headroom - build cost
- create a human approval queue for proposed tools
- generate endpoint implementation/tests/manifest from approved proposal
- deploy tool and monitor calls, buyers, revenue, uptime, margin
- repricing/retirement rules

## Security
- `PENNYRAIL_PAY_TO` is only a public receiving address.
- Keep the Radar buyer wallet tiny and separate.
- Never commit a private key to GitHub.
- Before mainnet, cap the Radar buyer wallet balance and paid refresh cadence.

## Current x402 assumptions
Built from x402 v2 docs available Aug 2026: `@x402/next`, `@x402/core`, `@x402/evm`; Base Sepolia testnet `eip155:84532`; Base mainnet `eip155:8453`; test facilitator `https://x402.org/facilitator`; mainnet default set to Coinbase's documented facilitator endpoint.


## Build fix v2
The x402 network identifier is explicitly typed as a CAIP-2 network (`${string}:${string}`), preserving `eip155:8453` / `eip155:84532` as the type expected by @x402/core RouteConfig.
