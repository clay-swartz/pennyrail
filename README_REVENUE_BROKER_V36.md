# PennyRail v36 — Proven-Demand Revenue Broker

v36 turns the v35 bestseller map into higher-value sellable primitives while keeping the original micro-utility portfolio intact.

## Why this build exists

The v35.1 audit mapped 23 of the top 50 paid Agent402 bestseller shapes. The largest uncovered demand was live web search (496 observed sales at $0.02/call), followed by paid chat/LLM, page metadata, token counting, embeddings, HTTP-header analysis and moderation.

v36 adds reusable primitives for those families instead of creating one-off endpoints.

## New sellable capabilities

No external key required:
- page metadata — $0.002
- HTTP headers + security analysis — $0.003
- exact BPE token count — $0.001

Requires `OPENAI_API_KEY`:
- live web search — $0.02 (OpenAI web search with GPT-5.4 nano; hard-capped to one web-search tool call)
- bounded GPT-4o-mini chat — $0.02
- bounded GPT-4o-mini inference — $0.01
- content moderation — $0.002
- text-embedding-3-small — $0.005
- text-embedding-3-large — $0.01
- OpenAI-compatible small embeddings — $0.002

Products requiring an upstream key are not advertised or auto-bid until the key is configured.

The web-search broker uses OpenAI rather than Brave because Brave's standard Search API terms prohibit redistributing/reselling Search Results. The OpenAI path is bounded to one built-in web-search call and validates returned result URLs against sources actually consulted by the search tool.

## Price alignment

Canonical prices are aligned to observed paid tickets where v35 exposed obvious gaps:
- DNS: $0.001 (legacy $0.003 URL remains callable)
- known EVM address label: $0.002 (legacy $0.001 URL remains callable)
- x402 seller momentum: $0.005 (legacy $0.004 URL remains callable)
- locale brief: $0.05 (legacy $0.01 URL remains callable)
- JWT toolkit: $0.05 (legacy $0.01 URL remains callable)

New price tiers: `$0.002`, `$0.005`, `$0.02`, `$0.05`, `$0.20`, while all prior route families remain supported.

## Distribution

The Revenue Engine automatically includes configured products in the public machine catalog/OpenAPI/x402 discovery surfaces. the402 provider activation now also exposes search, page intelligence, agent chat, embeddings, moderation and token-count services when their required upstream configuration exists.

The the402 direct catalog prices were also normalized toward PennyRail's penny-stacking strategy instead of the earlier coarse $0.01–$0.08 bundle prices.

## Radar UX

- Admin token can be entered once and exchanged for a 30-day HttpOnly, Secure, SameSite=Strict signed session cookie. The raw admin token is never stored in browser JavaScript/localStorage.
- `Copy JSON` / `Copy full JSON` buttons copy results without manual text selection.
- The audit explicitly separates `AUTO-LIVE`, `NEEDS-CONFIG`, and `NEEDS-PRIMITIVE`.
- Cache key is versioned as v36 so deployments cannot reuse the prior v35 audit mapping.

## Environment variables

Existing production environment variables remain unchanged.

Optional revenue unlock:
- `OPENAI_API_KEY`

Existing the402 variables, after one-time registration:
- `THE402_PARTICIPANT_ID`
- `THE402_API_KEY`
- `THE402_WEBHOOK_SECRET`

Never commit secrets to GitHub.

## Revenue objective

The operating objective remains portfolio-scale machine commerce: many inexpensive calls across many needs, targeting at least $1,000/day / $30,000/month aggregate revenue with no architecture ceiling. This is an operating target, not a revenue guarantee.
