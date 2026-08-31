import { createRouterFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createRouterFrontdoor({
  productId: "text.token-count",
  tier: "nano",
  price: "$0.001",
  description: "Exact LLM token count for AI agents. Count o200k_base or cl100k_base BPE tokens for context budgeting without a model call.",
  probeInput: { text: "PennyRail stacks tiny paid calls.", encoding: "o200k_base" },
});
