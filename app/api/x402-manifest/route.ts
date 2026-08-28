import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";
import { staticRevenueProductRoutes, type RevenueProductRoute } from "@/lib/revenue-engine";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";

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

  return NextResponse.json({
    spec: "agent402-service-manifest/1",
    version: 1,
    name: "PennyRail",
    summary: "Autonomous demand-aligned pay-per-call products for AI agents.",
    homepage: origin,
    resources: [
      `${origin}/api/tools/json-canonicalize`,
      `${origin}/api/tools/text-stats`,
      `${origin}/api/tools/strip-tracking`,
      ...FACTORY_CAPABILITIES.map(c => `${origin}/api/f/${c.id}`),
      ...revenueRoutes.map(p => `${origin}${p.path}`),
    ],
    payment: {
      x402: {
        version: 2,
        currency: "USDC",
        networks: [network],
        primaryNetwork: network,
        priceRange: "$0.001-$0.01",
        payTo,
        payToName: "PennyRail",
        nonCustodial: true,
      },
    },
    capabilities: {
      tools: FACTORY_CAPABILITIES.length + 3 + revenueRoutes.length,
      categories: [
        { key: "utility", label: "Core deterministic utilities", tools: FACTORY_CAPABILITIES.length + 3, priceRange: "$0.001" },
        { key: "revenue-engine", label: "Demand-aligned autonomous products", tools: revenueRoutes.length, priceRange: "$0.001-$0.01" },
      ],
    },
    discovery: {
      spec: "x402-discovery/1",
      openapi: `${origin}/openapi.json`,
    },
    mcp: {
      remoteConnector: null,
      package: null,
    },
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
