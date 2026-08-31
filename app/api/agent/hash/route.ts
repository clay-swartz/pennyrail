import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "crypto.hash-multi",
  tier: "nano",
  price: "$0.001",
  description: "Hash text with SHA-256, SHA-512, SHA-1 or MD5 and return hex plus Base64 digests. Ultra-cheap hashing for repeated AI-agent jobs.",
  probeInput: { text: "PennyRail", algorithm: "sha256" },
});
