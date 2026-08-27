# PennyRail CDP Buyer — EVM-only testnet bridge

PennyRail uses Coinbase CDP API-key wallets for the automated Radar buyer.

Required Vercel environment variables:
- CDP_API_KEY_ID
- CDP_API_KEY_SECRET
- CDP_WALLET_SECRET
- PENNYRAIL_PAY_TO
- X402_MODE=testnet
- RADAR_ADMIN_TOKEN

## Why this build does not use CdpX402Client

As of this build, Coinbase CDP SDK 1.55.0's convenience x402 client imports an SVM v1 subpath that is not present in the current x402 SVM package layout, causing Next.js bundling to fail even for an EVM-only application.

For the testnet MVP only, this build:
1. Uses the normal CdpClient to get-or-create the named EVM buyer wallet.
2. Exports that wallet key into server memory only.
3. Adapts it to the normal EVM-only x402 client.
4. Never logs, returns, commits, or stores the key in PennyRail.

This is intended only to prove the Base Sepolia x402 transaction loop. Before mainnet funds are used, migrate to a managed-signing path that never exports the private key.
