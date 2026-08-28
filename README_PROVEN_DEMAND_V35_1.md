# PennyRail Proven Demand v35.1

Hotfix on top of v35.

## Fix

The v35 deployment accidentally retained the v34 Next.js `unstable_cache` key (`pennyrail-revenue-multiplier-v34`). Because the audit cache revalidates every six hours, production could continue serving the exact v34 audit after v35 deployed.

v35.1 bumps the key to `pennyrail-proven-demand-v35-1`, forcing the first post-deploy audit to recompute against the v35 exact bestseller mappings and proven primitives.

No payment, wallet, pricing, route, marketplace, x402 List, x402scan, or the402 behavior changes. Default paid intelligence remains Bestsellers-only at a maximum of $0.005 per six-hour audit.
