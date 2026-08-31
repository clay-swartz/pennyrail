import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "text.stats",
  tier: "nano",
  price: "$0.0005",
  description: "Text statistics for AI agents: character, byte, word, line and non-empty-line counts in a deterministic micro-call.",
  probeInput: "PennyRail stacks tiny paid calls.",
});
