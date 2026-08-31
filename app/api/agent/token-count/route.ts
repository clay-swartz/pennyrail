import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "text.token-count",
  tier: "nano",
  price: "$0.0005",
  description: "Exact OpenAI BPE token count for AI agents using o200k_base or cl100k_base. Budget context windows without a model call.",
  probeInput: { text: "PennyRail stacks tiny paid calls.", encoding: "o200k_base" },
});
