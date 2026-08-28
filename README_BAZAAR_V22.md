# PennyRail Bazaar v22

Full-project build based on inventory v21.

Changes:
- Adds protocol-level Bazaar discovery metadata to all 47 factory utilities.
- Avoids the current @x402/next `withX402()` wildcard/Bazaar indexing bug by
  using an explicit x402HTTPResourceServer route map.
- Adds `Seed Bazaar` to the private operator screen.
- Seeding automatically settles one $0.001 call per factory utility in small
  batches using PennyRail's already-funded buyer wallet (~$0.047 total).
- Keeps the original three PennyTools and Agent402 listing flow unchanged.
