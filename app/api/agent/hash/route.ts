import { createRouterFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createRouterFrontdoor({
  productId: "crypto.hash-multi",
  tier: "nano",
  price: "$0.001",
  description: "Hashing and encoding for AI agents: compute SHA-256, SHA-512, SHA-1 or MD5 digests and return both hex and base64. Cheap deterministic hash utility.",
  probeInput: { text: "PennyRail", algorithm: "sha256" },
});
