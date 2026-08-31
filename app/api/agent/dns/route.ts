import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "dns.records",
  tier: "nano",
  price: "$0.0005",
  description: "DNS lookup for AI agents: A, AAAA, MX, TXT, CNAME, NS, CAA or SRV records via DNS-over-HTTPS.",
  probeInput: { domain: "example.com", type: "A" },
});
