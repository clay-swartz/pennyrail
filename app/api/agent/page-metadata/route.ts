import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "web.page-meta",
  tier: "mini",
  price: "$0.001",
  description: "Extract page and article metadata for AI agents: title, description, canonical URL, favicon, OpenGraph and Twitter cards.",
  probeInput: { url: "https://example.com" },
});
