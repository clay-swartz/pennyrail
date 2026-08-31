import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "chain.block-number",
  tier: "nano",
  price: "$0.001",
  description: "Latest EVM block number for Base, Ethereum, Polygon, Arbitrum or Optimism. Ultra-cheap current onchain read for agents.",
  probeInput: { network: "base" },
});
