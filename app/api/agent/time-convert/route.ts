import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "time.convert-any",
  tier: "nano",
  price: "$0.001",
  description: "Convert epoch seconds, milliseconds or ISO timestamps and render any IANA timezone. Cheap deterministic time utility for agents.",
  probeInput: { value: 1767225600, timezone: "America/Chicago" },
});
