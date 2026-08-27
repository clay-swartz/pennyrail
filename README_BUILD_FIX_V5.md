# PennyRail CDP Buyer v5

Fixes the runtime buyer-wallet error caused by Coinbase `exportAccount()` returning an EVM private key without the `0x` prefix expected by viem. The key is normalized in server memory only and is never logged or returned.
