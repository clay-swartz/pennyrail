import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "utility.random-secure",
  tier: "nano",
  price: "$0.0005",
  description: "Cryptographically secure random bytes or unbiased random integers for AI agents. High-frequency deterministic utility at half a tenth of a cent.",
  probeInput: { min: 1, max: 100, count: 3 },
});
