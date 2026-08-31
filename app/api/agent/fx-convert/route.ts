import { createFactoryFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createFactoryFrontdoor({
  operation: "fx.convert",
  price: "$0.001",
  description: "Current currency conversion and FX reference rates for AI agents using ECB-backed market data.",
  probeInput: { amount: 1, from: "USD", to: "EUR" },
});
