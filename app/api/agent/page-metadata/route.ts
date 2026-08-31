import { createRouterFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createRouterFrontdoor({
  productId: "web.page-meta",
  tier: "mini",
  price: "$0.002",
  description: "Web page and article metadata extraction for AI agents: title, description, canonical URL, favicon, OpenGraph and Twitter card fields.",
  probeInput: { url: "https://example.com" },
});
