import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";
import { staticRevenueProductRoutes, type RevenueProductRoute } from "@/lib/revenue-engine";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { BAZAAR_WEB_SEARCH_PATH } from "@/lib/x402-bazaar";

export const dynamic = "force-dynamic";

function cleanOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const origin = cleanOrigin(req);
  const mainnet = process.env.X402_MODE?.trim() === "mainnet";
  const payTo = process.env.PENNYRAIL_PAY_TO || "";
  const network = mainnet ? "eip155:8453" : "eip155:84532";
  const revenueAudit = await getCachedRevenueAudit();
  const revenueRoutes: RevenueProductRoute[] = Array.isArray(revenueAudit.productRoutes) && revenueAudit.productRoutes.length
    ? revenueAudit.productRoutes as RevenueProductRoute[]
    : staticRevenueProductRoutes();

  const routerTiers = ["nano","mini","network","micro","intel","standard","premium","skill","analyst"];

  return NextResponse.json({
    spec: "agent402-service-manifest/1",
    x402Version: 2,
    version: 2,
    name: "PennyRail",
    summary: "Agent transaction router with live web search, current research, data utilities and paid machine services. Free find and quote; pay only for execution.",
    homepage: origin,
    resources: [
      // Revenue acquisition: make the proven isolated live-web-search route
      // directly crawlable/routable by active x402 buyer routers.
      `${origin}${BAZAAR_WEB_SEARCH_PATH}`,
      `${origin}/api/tools/json-canonicalize`,
      `${origin}/api/tools/text-stats`,
      `${origin}/api/tools/strip-tracking`,
      ...FACTORY_CAPABILITIES.map(c => `${origin}/api/f/${c.id}`),
      ...revenueRoutes.map(p => `${origin}${p.path}`),
      ...routerTiers.map(tier => `${origin}/api/router/execute/${tier}`),
    ],
    payment: {
      x402: {
        version: 2,
        currency: "USDC",
        networks: [network],
        primaryNetwork: network,
        priceRange: "$0.001-$0.20",
        payTo,
        payToName: "PennyRail",
        nonCustodial: true,
      },
    },
    capabilities: {
      tools: FACTORY_CAPABILITIES.length + 4 + revenueRoutes.length + routerTiers.length,
      categories: [
        { key: "search", label: "Live web search and current research with grounded sources", tools: 1, priceRange: "$0.02" },
        { key: "router", label: "Universal intent router execution tiers", tools: routerTiers.length, priceRange: "$0.001-$0.20" },
        { key: "utility", label: "Core deterministic utilities", tools: FACTORY_CAPABILITIES.length + 3, priceRange: "$0.001" },
        { key: "revenue-engine", label: "Demand-aligned autonomous products", tools: revenueRoutes.length, priceRange: "$0.001-$0.20" },
      ],
    },
    routing: {
      featured: [{
        resource: `${origin}${BAZAAR_WEB_SEARCH_PATH}`,
        method: "POST",
        priceUsd: 0.02,
        intents: [
          "web search",
          "search the web",
          "live web search",
          "current information",
          "latest information",
          "current events",
          "latest news",
          "research",
          "fresh sources",
          "grounded answer with sources",
        ],
        description: "Live web search for AI agents. Returns a grounded answer plus current sources for research, current events, news and up-to-date information.",
      }],
    },
    discovery: {
      spec: "x402-discovery/1",
      openapi: `${origin}/openapi.json`,
      router: {
        find: `${origin}/api/router/find`,
        quote: `${origin}/api/router/quote`,
        executePattern: `${origin}/api/router/execute/{tier}`,
        guidance: "Discovery and quote are free. Pay exactly one returned execute tier to run the selected capability.",
      },
    },
    mcp: {
      remoteConnector: `${origin}/api/mcp`,
      package: null,
    },
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
