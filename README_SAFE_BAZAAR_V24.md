# PennyRail Safe Bazaar v24

Full-project build based on v23.

Fix:
- Overwrites the stale v22 `/api/radar/seed-bazaar` route that can remain in
  GitHub after full-folder uploads because uploads do not delete old files.
- The legacy route no longer imports `factorySampleInput`, so Vercel can build.
- Production 47 factory routes remain on the proven v21 x402 wrapper.
- Bazaar remains isolated to the single `$0.001` Test Bazaar probe.
