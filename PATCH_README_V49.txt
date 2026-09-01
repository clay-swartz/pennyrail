PennyRail v49 patch

File included:
- lib/kalshi-paper.ts

What changes:
- Replaces the hypothetical 96-times-per-day extrapolation with the actual
  active and upcoming Kalshi liquidity-reward schedule for the next 24 hours.
- Sums only reward dollars scheduled inside that 24-hour window.
- Prorates long-running reward pools to their actual overlap with the window.
- Evaluates current public markets and books for scheduled short-duration
  programs, while preserving the corrected v48 price-level scoring.
- Reports actual scheduled gross paper reward, peak overlapping capital, raw
  scheduled payer inventory, schedule completeness, and program counts.
- The persistent-worker gate can be reached only from scheduled 24-hour reward,
  never from a single 15-minute period multiplied as if it repeats all day.

Safety:
- Public data only.
- No credentials.
- No orders.
- No trading.
- No capital.

After Production is green, open:
https://pennyrail.vercel.app/api/money/kalshi-paper

Report green. The assistant will fetch and analyze the live JSON directly.
