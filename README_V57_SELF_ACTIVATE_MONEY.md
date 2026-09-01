# PennyRail v57 — self-activate money channels

Revenue-only release.

The v56 production hunter proved:
- PennyRail is indexed/routable on Agent402: 438 tools, Base mainnet, health 1.
- Agent402 bestsellers purchase works.
- Agent402 paid demand-radar retry failed with HTTP 402.
- the402 was inactive only because env credentials were absent.

v57 removes both blockers.

1. Agent402 unmet demand:
   - reads the public `/api/wishes` raw feed for free
   - pays only for `/api/bestsellers` ($0.005; hard capped at $0.006)
   - PennyRail's own scorer determines what it can sell now vs what remains a gap

2. the402:
   - PennyRail self-registers as a provider via x402 ($0.01 hard-capped in existing code)
   - registration returns participant ID, API key and webhook secret
   - credentials are cached per runtime
   - PennyRail activates/list services, subscribes to paid requests, bids, fulfills and reads earnings
   - webhook uses a stable private bootstrap token before dynamic credential recovery, preventing arbitrary callers from triggering paid registration

No manual the402 account setup is required.
