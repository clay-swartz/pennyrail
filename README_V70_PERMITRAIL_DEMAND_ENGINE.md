# PennyRail v70 — PermitRail Demand Engine

## Why this release exists

v69 proved PermitRail can accept recurring Stripe subscriptions and RapidAPI requests. v70 removes the remaining passive assumption: it continuously finds plausible business buyers, matches each buyer to live PermitRail demand, and prepares a bounded automated acquisition pipeline.

## New money machinery

### 1. Licensed-contractor prospect radar

PermitRail reads the State of Texas TDLR All Licenses public dataset (`7358-krk7`) directly. It currently focuses on Dallas/Tarrant businesses in license classes that map cleanly to live PermitRail trades:

- Electrical Contractor → electrical
- A/C Contractor → HVAC
- Mold Remediation Company / Contractor → restoration

Each public licensed business is scored against PermitRail's current project inventory. Tarrant prospects are routed to Fort Worth or Arlington based on where matching live project demand is strongest; Dallas prospects route to Dallas. No paid lead list is required.

The stored/public acquisition status contains aggregates only. The detailed business prospect list is used transiently during an acquisition run and is not published as a new consumer-data product.

### 2. Live market proof pages

`/permitrail/market/{city}/{trade}`

Every supported city/trade pair has a public page showing current signal counts, hot/warm counts, masked sample addresses, source-derived project details and a preconfigured $299/month Starter checkout for that exact market/trade.

`/sitemap.xml` now includes PermitRail plus every market/trade sample page.

### 3. Smartlead-ready active outreach

v70 integrates the current Smartlead REST API and SmartProspect contact database, but **cannot send by default**.

To become live it requires all four of these explicit production conditions:

- `SMARTLEAD_API_KEY`
- `PERMITRAIL_POSTAL_ADDRESS`
- `PERMITRAIL_OUTREACH_SENDER_READY=true`
- `PERMITRAIL_OUTREACH_LIVE=true`

That deliberately separates "code ready" from "commercial email authorized." A valid physical postal address is required for U.S. commercial-email compliance. Sender readiness is a separate positive acknowledgement because Smartlead recommends warming sending accounts before cold outreach.

When live, the engine:

1. reads public TDLR businesses;
2. matches them to current PermitRail demand;
3. searches SmartProspect for decision-makers at those companies;
4. fetches at most the daily cap of contact emails;
5. creates/reuses one PermitRail campaign;
6. links one connected Smartlead sender;
7. installs a two-message sequence with a truthful live-market URL, commercial-message disclosure, physical postal address and `%unsubscribe-text%`;
8. disables open/click tracking;
9. stops follow-ups on reply;
10. sends weekdays in America/Chicago at a maximum of 20 new leads/day before any PermitRail Stripe revenue, automatically rising only to 40/day after real subscription revenue appears;
11. polls campaign analytics for sent/replied/bounced/unsubscribed counts.

The engine never purchases SmartProspect credits itself and never purchases domains/mailboxes. If included credits are unavailable, the API fails rather than PennyRail buying more.

### 4. Background autonomy

`/api/autopilot/bootstrap` now ensures the 6-hour PermitRail acquisition chain is scheduled alongside the existing 30-minute PermitRail data refresh, Portfolio Engine, BatchRail, corrected Polymarket measurement and corrected Kalshi paper measurement.

Public non-secret status:

`/api/permitrail/acquisition/status`

## Still true

- Outside revenue is only money from outside buyers.
- RapidAPI, Stripe, x402, BatchRail, bounties, broker/reseller and exchange measurement remain parallel lanes.
- No live Polymarket/Kalshi capital is enabled.
- No outreach is enabled merely by deploying v70.
