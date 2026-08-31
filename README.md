# PennyRail

PennyRail is an autonomous machine-commerce yield engine: observe paid agent demand, identify monetizable capability gaps, publish the smallest reliable solution, charge per machine call, distribute it across agent-buying surfaces, and keep expanding the portfolio around proven demand.

## Current build — v36 Revenue Broker

Current revenue loop:

`PAID DEMAND → MAP/GAP → BUILD REUSABLE PRIMITIVE → PRICE → PUBLISH → SELL/BID → MEASURE → MULTIPLY`

The production stack includes:
- Base USDC x402 settlement with the proven Coinbase facilitator integration
- 47 original factory capabilities plus proven-demand templates
- dynamic revenue-product routes and machine-readable OpenAPI/x402 discovery
- paid Agent402 Bestsellers intelligence every six hours (Demand Radar disabled while its upstream itemized feed is empty)
- x402scan registration and x402 List review submission
- the402 provider/catalog/request-bidding integration
- optional OpenAI upstream broker capabilities, including live web search
- private Radar dashboard with on-chain outside-revenue tracking, remembered admin access and one-click JSON copying

See `README_REVENUE_BROKER_V36.md` for the current revenue build. Historical version notes are intentionally preserved in the versioned README files.

## Production secrets

Secrets belong in Vercel Production environment variables only. Never commit admin tokens, wallet credentials, provider API keys, webhook secrets or OpenAI keys to the repository.

## Operating objective

Maximize aggregate machine-commerce gross profit across many tiny transactions. Current internal target: at least $1,000/day / $30,000/month, with no architecture ceiling. This is a target, not a guarantee.
