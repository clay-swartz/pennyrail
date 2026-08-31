import { createRouterFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createRouterFrontdoor({
  productId: "chain.block-number",
  tier: "nano",
  price: "$0.001",
  description: "Crypto and onchain read for AI agents: return the latest EVM block number for Base, Ethereum, Polygon, Arbitrum or Optimism.",
  probeInput: { network: "base" },
});
