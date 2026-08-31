import { createFactoryFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createFactoryFrontdoor({
  operation: "encoding.base64-decode",
  price: "$0.001",
  description: "Base64 decode for AI agents. Decode Base64 text to UTF-8 in one cheap deterministic paid call.",
  probeInput: "UGVubnlSYWls",
});
