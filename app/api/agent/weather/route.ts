import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "weather.current",
  tier: "network",
  price: "$0.0015",
  description: "Current global weather for AI agents by city or coordinates: temperature, wind and current conditions. No API key.",
  probeInput: { city: "Dallas" },
});
