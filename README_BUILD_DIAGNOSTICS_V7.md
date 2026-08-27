# PennyRail CDP diagnostics v7

Adds an admin-only Coinbase authentication diagnostic at `/api/radar/diagnostics` and a dashboard button.

It checks, without returning any secret values:

1. Ed25519 API-key secret format (expects 64 decoded bytes).
2. Wallet Secret local PKCS#8 / EC parseability.
3. Coinbase API-key authentication using an authenticated account-list GET.
4. Coinbase Wallet Secret authentication using the managed buyer account and a harmless message signature.

It also trims the three Coinbase environment variables before constructing `CdpClient` to avoid copy/paste whitespace issues.

No private wallet key is exported by PennyRail.
