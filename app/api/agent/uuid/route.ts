import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "utility.uuid-generate",
  tier: "nano",
  price: "$0.001",
  description: "Generate UUID v4 or time-ordered UUID v7 values for AI-agent workflows. Cheap repeated machine IDs with no API key.",
  probeInput: { version: 7, count: 3 },
});
