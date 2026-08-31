import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { facilitatorUrl, mode, network, payTo } from "@/lib/x402-server";

const customFacilitatorUrl = process.env.X402_FACILITATOR_URL?.trim();
const facilitator = mode === "mainnet" && !customFacilitatorUrl
  ? createCdpFacilitatorClient()
  : new HTTPFacilitatorClient({ url: facilitatorUrl });

const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);

export const BAZAAR_WEB_SEARCH_PATH = "/api/bazaar/web-search";

const discovery = declareDiscoveryExtension({
  bodyType: "json",
  input: {
    query: "latest x402 agent commerce news",
    count: 5,
    freshness: "pw",
  },
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, description: "Natural-language web search query." },
      q: { type: "string", minLength: 1, description: "Alias for query." },
      count: { type: "integer", minimum: 1, maximum: 10 },
      freshness: { type: "string", enum: ["pd", "pw", "pm", "py"] },
      country: { type: "string" },
    },
    additionalProperties: true,
  },
  output: {
    example: {
      ok: true,
      productId: "web.search",
      title: "Live web search",
      priceUsd: 0.02,
      result: {
        answer: "Grounded answer from current web results.",
        sources: [
          { title: "Example source", url: "https://example.com" },
        ],
      },
    },
  },
} as any);

export const bazaarWebSearchHttpServer = new x402HTTPResourceServer(resourceServer, {
  [`POST ${BAZAAR_WEB_SEARCH_PATH}`]: {
    accepts: [{
      scheme: "exact",
      price: "$0.02",
      network,
      payTo,
    }],
    description: "Live web search for AI agents. Pay $0.02 USDC on Base and receive a grounded answer plus sources.",
    mimeType: "application/json",
    extensions: { ...discovery },
  },
} as any);

// Preserve the v23/v24 safety boundary:
// Bazaar remains disabled on the dynamic factory/revenue wildcard routes.
// Only explicit static routes exported from this file carry Bazaar metadata.
export const bazaarFactoryWildcardDisabled = true;
export const bazaarStaticWebSearchEnabled = true;
