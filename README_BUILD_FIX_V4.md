# PennyRail CDP build fix v4

This build keeps `@coinbase/cdp-sdk` external to Next/Turbopack using the official `serverExternalPackages` option. PennyRail only uses CDP EVM APIs, so this prevents Turbopack from eagerly walking Coinbase's Solana-only dynamic imports.

It also installs `@x402/svm@2.23.0` as a runtime peer-dependency safety net because CDP SDK 1.55.0 declares it as an optional x402 peer.

No environment-variable changes are required.
