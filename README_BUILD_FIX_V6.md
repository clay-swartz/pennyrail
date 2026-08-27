# Build/runtime fix v6 — Coinbase-managed EVM signer

This version removes the temporary `exportAccount()` / `privateKeyToAccount()` bridge.

Coinbase's `EvmServerAccount` already provides the signer surface x402 needs (`address` and `signTypedData`). PennyRail now passes that managed account directly to the EVM x402 client, so the buyer private key never leaves Coinbase.

It also separates wallet lookup from payment-client construction. `Show buyer wallet` and `Fund test buyer` no longer export or parse any private key.
