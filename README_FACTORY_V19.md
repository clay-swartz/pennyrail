# PennyRail Factory v19

- Factory scan now buys only Demand Radar ($0.005), removing the unnecessary Bestsellers dependency.
- Recursively unwraps x402 response envelopes and accepts either `radar` or detailed `clusters` rows.
- Always displays the complete factory result when no rows are extracted.
- Adds response diagnostics so a successful paid call can never look like a dead button.
