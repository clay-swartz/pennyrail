PennyRail v48 patch

Files included:
- lib/kalshi-paper.ts
- lib/money-radar.ts

What changes:
- Corrects same-price target-boundary scoring in the Kalshi paper model by
  merging the hypothetical order into the exchange's aggregated price level
  and applying the target cutoff proportionally.
- Requires both hypothetical orders to receive a positive score before a
  market can enter the paper portfolio.
- Replaces the generic 1,000-contract volume cutoff with an incentive-specific
  observability gate using recent volume or open interest, while preserving
  spread, qualification, and one-sided-risk checks.
- Marks the snapshot portfolio gate explicitly as gross-only.
- Fixes Money Radar's one-hour duration floor so 15-minute reward programs are
  normalized against their actual 15-minute period.
- Normalizes floating-point spreads so an exact five-cent spread is not
  accidentally rejected as 0.050000000000000044.

Safety:
- Public data only.
- No credentials.
- No orders.
- No trading.
- No capital.

After Production is green, open:
https://pennyrail.vercel.app/api/money/kalshi-paper

Send the complete JSON back for the next decision.
