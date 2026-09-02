# PennyRail v63 — Private money dashboard

Operator-only monitoring surface:

`/money`

The page uses PennyRail's existing Radar admin session. If this browser does not
already have a session cookie, it asks for `RADAR_ADMIN_TOKEN` once and stores
only the existing signed HttpOnly session cookie.

The dashboard auto-refreshes every 30 seconds and separates:

## Actual money

- outside Base USDC received over the approximate last 24 hours
- outside payer count
- outside transfer count
- internal/test transfers explicitly excluded
- configured receiving wallet + BaseScan link

## Paper / opportunity data

- persistent Kalshi modeled net/day
- reward component
- trade/fill component
- samples, coverage, gate-hit rate
- last snapshot economics
- persistent market evidence
- live-capital gate status

## Parallel radar

- current primary lane
- cross-venue arbitrage count / top edge
- x402 hunter health
- Agent402 registration

This is deliberately a private operator screen. The public PennyRail root remains
the machine-facing service record.
