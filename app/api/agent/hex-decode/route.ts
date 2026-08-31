import { createFactoryFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createFactoryFrontdoor({
  operation: "encoding.hex-decode",
  price: "$0.001",
  description: "Hex decode for AI agents. Decode hexadecimal bytes to UTF-8 in one ultra-cheap deterministic call.",
  probeInput: "50656e6e795261696c",
});
