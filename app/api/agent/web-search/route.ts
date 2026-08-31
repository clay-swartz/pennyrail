import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "web.search",
  tier: "premium",
  price: "$0.018",
  description: "Live web search for AI agents: current information, latest news and research with grounded source URLs and titles. Cheaper than the common $0.02 agent-search price.",
  probeInput: { query: "latest x402 agent commerce news", count: 5, freshness: "pw" },
});
