# PennyRail — CDP Buyer Wallet Integration

This patch replaces `RADAR_BUYER_PRIVATE_KEY` with Coinbase CDP API-key wallet authentication.

## Vercel environment variables

Add these to PennyRail Production:

- `CDP_API_KEY_ID` — Coinbase API Key ID
- `CDP_API_KEY_SECRET` — Coinbase Secret
- `CDP_WALLET_SECRET` — Coinbase Wallet Secret
- `PENNYRAIL_PAY_TO` — seller public address
- `X402_MODE` — `testnet`
- `RADAR_ADMIN_TOKEN` — your private dashboard token

Remove/ignore the old `RADAR_BUYER_PRIVATE_KEY` variable.

## After deployment

1. Open PennyRail.
2. Paste `RADAR_ADMIN_TOKEN` into Admin access.
3. Click **Show buyer wallet**. CDP will provision/reuse the managed x402 buyer and show its Base-compatible EVM address.
4. Click **Fund test buyer**. This requests Base Sepolia test USDC from the Coinbase faucet.
5. After the faucet confirms, click **Run $0.001 self-test**.
6. A successful result proves: PennyRail buyer -> x402 payment -> PennyRail protected tool -> seller address -> protected JSON response.
7. Then click **Buy fresh intelligence** to let the Radar buyer purchase Agent402 Demand Radar + Bestsellers.

No raw wallet private key is stored in Vercel.
