import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { facilitatorUrl, mode, network, payTo } from "@/lib/x402-server";
import { GAP_ARBITRAGE_PRODUCTS, type GapArbitrageProduct } from "@/lib/gap-arbitrage-catalog";

const customFacilitatorUrl = process.env.X402_FACILITATOR_URL?.trim();
const facilitator = mode === "mainnet" && !customFacilitatorUrl
  ? createCdpFacilitatorClient()
  : new HTTPFacilitatorClient({ url: facilitatorUrl });

const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);

export const BAZAAR_WEB_SEARCH_PATH = "/api/bazaar/web-search";
export const AGENT_EXECUTE_PATH = "/v1/agents/execute";
export const AGENT_EXECUTE_PRICE_USD = 0.75;

const webSearchDiscovery = declareDiscoveryExtension({
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
        sources: [{ title: "Example source", url: "https://example.com" }],
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
    extensions: { ...webSearchDiscovery },
  },
} as any);

const agentExecuteDiscovery = declareDiscoveryExtension({
  bodyType: "json",
  input: {
    task: "Research the latest x402 buyer trend and return the most important finding.",
    context: "Be concise and cite the decisive evidence.",
    max_steps: 3,
    tools: ["web_search"],
  },
  inputSchema: {
    type: "object",
    required: ["task"],
    properties: {
      task: { type: "string", minLength: 1, maxLength: 6000, description: "Natural-language task for the agent to execute." },
      context: { type: "string", maxLength: 8000, description: "Optional context or constraints." },
      max_steps: { type: "integer", minimum: 1, maximum: 8 },
      tools: {
        type: "array",
        maxItems: 3,
        items: { type: "string", enum: ["web_search", "code_exec", "data_analysis"] },
      },
    },
    additionalProperties: false,
  },
  output: {
    example: {
      id: "resp_example",
      object: "agent.execution",
      model: "gpt-5.4-mini",
      task: "Research the latest x402 buyer trend.",
      status: "completed",
      steps_executed: 2,
      output: {
        reasoning: "Checked the current source and summarized the decisive evidence.",
        result: "The requested result.",
        confidence: 0.92,
      },
      usage: { reasoning_tokens: 120, action_tokens: 280, total_tokens: 900, tools_invoked: 1 },
    },
  },
} as any);

export const agentExecuteHttpServer = new x402HTTPResourceServer(resourceServer, {
  [`POST ${AGENT_EXECUTE_PATH}`]: {
    accepts: [{
      scheme: "exact",
      price: `$${AGENT_EXECUTE_PRICE_USD}`,
      network,
      payTo,
    }],
    description: "Bounded autonomous AI agent execution with optional web search or code/data analysis. Multi-step task completion without signup or API keys.",
    mimeType: "application/json",
    serviceName: "PennyRail Agent Execute",
    tags: ["AI", "agent", "inference", "research", "tool-use", "x402"],
    extensions: { ...agentExecuteDiscovery },
  },
} as any);

export type BazaarGapProduct = GapArbitrageProduct & { slug: string; bazaarPath: string };

export const BAZAAR_GAP_PRODUCTS: BazaarGapProduct[] = GAP_ARBITRAGE_PRODUCTS.map((product: GapArbitrageProduct): BazaarGapProduct => ({
  ...product,
  slug: product.path.replace(/^\/api\/agent\//, ""),
  bazaarPath: product.path.replace(/^\/api\/agent\//, "/api/bazaar/"),
}));

const gapRouteConfig: Record<string, any> = {};
for (const product of BAZAAR_GAP_PRODUCTS) {
  const discovery = declareDiscoveryExtension({
    bodyType: "json",
    input: product.sampleInput,
    inputSchema: {
      type: "object",
      description: `Input for ${product.title}.`,
      additionalProperties: true,
    },
    output: {
      example: {
        ok: true,
        productId: product.id,
        title: product.title,
        priceUsd: product.priceUsd,
        result: {},
      },
    },
  } as any);

  const browserDiscoveryMetadata = product.id === "browser.render"
    ? {
        serviceName: "PennyRail Browser Render",
        tags: ["browser", "render", "markdown", "web", "agents"],
      }
    : {};

  gapRouteConfig[`POST ${product.bazaarPath}`] = {
    accepts: [{
      scheme: "exact",
      price: `$${product.priceUsd}`,
      network,
      payTo,
    }],
    description: `${product.description} Exact-match PennyRail gap-arbitrage route.`,
    mimeType: "application/json",
    extensions: { ...discovery },
    ...browserDiscoveryMetadata,
  };
}

export const bazaarGapHttpServer = new x402HTTPResourceServer(resourceServer, gapRouteConfig as any);

// Preserve the settled v23/v24 safety boundary:
// - dynamic factory/revenue wildcards NEVER carry Bazaar metadata.
// - only the explicit, finite product whitelist above is Bazaar-visible.
export const bazaarFactoryWildcardDisabled = true;
export const bazaarStaticWebSearchEnabled = true;
export const bazaarStaticGapProductsEnabled = true;
