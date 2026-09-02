# PennyRail v64 — Correct Kalshi economics

This release fixes the overnight paper-accounting mismatch revealed by the money dashboard.

What was wrong:
- the worker accrued `continuousRunRateUsdPerDay`, a diagnostic field that assumes a short incentive period repeats continuously;
- the real Kalshi gate uses only reward dollars actually scheduled during the period / next 24 hours;
- this inflated the overnight reward and net/day headline.

What changes:
- each observed quote stores the modeled reward share for its actual scheduled incentive period;
- interval reward is prorated only across that real period;
- reward attribution belongs to the previously observed quotes;
- a clean v64 paper window starts automatically so contaminated totals cannot leak into the corrected gate;
- the dashboard now shows average / min / max / latest actually scheduled 24-hour reward inventory prominently.

Real-money accounting is unchanged. Outside Base USDC remains the only thing labeled actual revenue.
