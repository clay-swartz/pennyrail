# PennyRail Factory v20

Full-project build based on v19.

Changes:
- Automatically retries Agent402 Demand Radar up to 3 times on transient 502/503/504 responses.
- Uses short backoff between retries.
- Returns retry diagnostics when the upstream remains unavailable.
- Keeps the v19 full response diagnostics and paid factory workflow.
