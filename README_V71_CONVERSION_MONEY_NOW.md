# PennyRail v71 — PermitRail Conversion UX + Money Now

## Why this release exists

v70 turned on the active PermitRail demand engine. v71 fixes two conversion/operations problems identified immediately after production review:

1. the PermitRail customer-facing experience looked like an internal tool and inherited the dark PennyRail shell;
2. the private money dashboard could lag a new Stripe payment until the Portfolio Engine's durable reconciliation tick.

## Customer-facing conversion UX

`/permitrail` is now an explicitly light, conventional SaaS storefront with:

- clear contractor outcome before product jargon;
- live current PermitRail signal/high-priority/source counts from the existing durable state;
- live high-score examples;
- concise "how it works" explanation;
- three clearly differentiated plans;
- one short configuration flow per relevant plan rather than duplicate unnecessary fields;
- direct Stripe checkout buttons with the exact monthly price in the CTA;
- responsive card/grid layout;
- visible source/public-data positioning;
- current-coverage wording that does not pretend Dallas building-permit coverage exists when it does not;
- checkout-error feedback;
- no black customer-facing background.

`/permitrail/market/{city}/{trade}` — the pages v70 sends prospects to — received the same light conversion treatment. They show live counts and masked sample opportunities next to a preconfigured checkout for that exact market/trade.

`/permitrail/success` no longer dumps a technical URL as the primary experience. It confirms the subscription, offers one-click live-feed and CSV access, then exposes the private URL and optional filters.

## Money Now

New private route:

`/api/money/now`

It requires the existing Radar admin session/token and queries the live rails on every request:

- Stripe paid PermitRail invoices directly;
- Base USDC outside inflow directly;
- durable Portfolio state for MoltJobs, spend and all-time accounting.

The new Money Now panel sits at the top of `/money`, refreshes every 10 seconds, and shows:

- gross outside revenue ~24h;
- known costs ~24h;
- NET ~24h;
- outside payment count;
- all-time outside revenue and all-time NET from the durable ledger;
- Stripe and x402 rail breakdown;
- first outside-payment timestamp/source when the durable ledger records it.

RapidAPI note: normal rapidapi.com providers can see near-real-time traffic/revenue in Studio and payout status under Monetize → Transactions, but the publicly documented Platform API is Enterprise-Hub-only. v71 therefore does not invent an automated RapidAPI revenue number; it labels that rail honestly until a provider-accessible revenue feed exists.

## x402 directory

PennyRail's directory approval is additive background distribution. No new credential is required by v71. Directory/listing status is not counted as revenue.

## Unchanged

- v70 acquisition engine remains intact.
- Stripe checkout remains live.
- RapidAPI remains public and tested.
- x402, Agent402/x402dash, BatchRail and other background distribution remain live.
- corrected Kalshi/Polymarket measurement remains paper-only / disabled for capital.
- only outside money counts as revenue.
