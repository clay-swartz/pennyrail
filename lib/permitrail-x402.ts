import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { facilitatorUrl, mode, network, payTo } from "@/lib/x402-server";

export const PERMITRAIL_FEED_PRICE_USD = 1;
export const PERMITRAIL_TERRITORY_PRICE_USD = 5;

const customFacilitatorUrl = process.env.X402_FACILITATOR_URL?.trim();
const facilitator = mode === "mainnet" && !customFacilitatorUrl
  ? createCdpFacilitatorClient()
  : new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);

function discovery(maxResults: number, territory = false) {
  return declareDiscoveryExtension({
    bodyType: "json",
    input: { city: "fortworth", trade: "roofing", minScore: 55, maxAgeHours: 168, limit: Math.min(50, maxResults) },
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", enum: ["all", "fortworth", "arlington", "dallas"] },
        trade: { type: "string", description: "Trade filter such as roofing, hvac, plumbing, electrical, fencing, pool, concrete, general-contractor, or all." },
        minScore: { type: "number", minimum: 0, maximum: 100 },
        maxAgeHours: { type: "number", minimum: 1, maximum: 2160 },
        limit: { type: "integer", minimum: 1, maximum: maxResults },
      },
      additionalProperties: false,
    },
    output: {
      example: {
        ok: true,
        count: 1,
        signals: [{ city: "fortworth", primaryTrade: "roofing", score: 86, urgency: "hot", estimatedOpportunityValueUsd: 18000, sourceKind: "building-permit" }],
        ...(territory ? { tier: "territory" } : {}),
      },
    },
  } as any);
}

export const permitRailHttpServer = new x402HTTPResourceServer(resourceServer, {
  "POST /api/permitrail/feed": {
    accepts: [{ scheme: "exact", price: `$${PERMITRAIL_FEED_PRICE_USD}`, network, payTo }],
    description: "PermitRail DFW project intelligence: up to 100 fresh public-record signals, trade-inferred and scored for recency, value and downstream opportunity.",
    mimeType: "application/json",
    serviceName: "PennyRail PermitRail Project Intelligence",
    tags: ["permits", "construction", "leads", "dfw", "contractors", "project-intelligence", "x402"],
    extensions: { ...discovery(100, false) },
  },
  "POST /api/permitrail/territory": {
    accepts: [{ scheme: "exact", price: `$${PERMITRAIL_TERRITORY_PRICE_USD}`, network, payTo }],
    description: "PermitRail territory pack: up to 500 scored DFW permit/project signals with public-source evidence and city/trade filters.",
    mimeType: "application/json",
    serviceName: "PennyRail PermitRail Territory Pack",
    tags: ["permits", "construction", "territory", "leads", "dfw", "data", "x402"],
    extensions: { ...discovery(500, true) },
  },
} as any);
