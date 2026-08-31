import { createFactoryFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createFactoryFrontdoor({
  operation: "fx.convert",
  price: "$0.001",
  description: "Market and financial data utility for AI agents: convert currency amounts between ISO currencies using current FX rates.",
  probeInput: { amount: 1, from: "USD", to: "EUR" },
});
