# PennyRail v53 — Lead Yield Radar

Goal: stop optimizing for activity and start scanning a mature buyer market with materially larger payouts.

This patch adds a daily-cached internal scanner for Lead Smart's public ZIP × service payout coverage.

New:
- `GET /api/money/lead-yield`
- cron output now includes `leadYieldRadar`
- ranks observed payout rows
- calculates the number of equal-payout calls needed to reach $1,000 gross/day
- A/B/C priority based on payout size

This does not claim traffic is free or that payout equals profit. It identifies the revenue side of the spread so the next build can compare acquisition cost and activate only positive-spread markets.
