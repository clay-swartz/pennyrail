# PennyRail Radar v16

Full-project build based on the last known-good v12 project.

Changes:
- Fixes Scan live gaps so browser/API errors are visible instead of silently disappearing.
- Adds timeouts to Agent402 wishes/find requests so scans cannot hang indefinitely.
- Limits first-pass supply checks for faster results.
- Corrects Base mainnet discovery metadata to CAIP-2 `eip155:8453`.
- Keeps the private operator console at `/r/7f2d4c`.
- Keeps the public root intentionally sparse.
