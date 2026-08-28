import { NextRequest, NextResponse } from "next/server";

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

  return NextResponse.json({
    spec: "agent402-service-manifest/1",
    version: 1,
    name: "PennyRail",
    summary: "Tiny deterministic pay-per-call utilities for autonomous agents.",
    homepage: origin,
    resources: [
      `${origin}/api/tools/json-canonicalize`,
      `${origin}/api/tools/text-stats`,
      `${origin}/api/tools/strip-tracking`,
      `${origin}/api/factory/run`,
    ],
    payment: {
      x402: {
        version: 2,
        currency: "USDC",
        networks: [network],
        primaryNetwork: network,
        priceRange: "$0.001-$0.003",
        payTo,
        payToName: "PennyRail",
        nonCustodial: true,
      },
    },
    capabilities: {
      tools: 4,
      categories: [
        { key: "utility", label: "Deterministic utilities", tools: 3, priceRange: "$0.001" },
        { key: "factory", label: "Dynamic micro-capability factory", tools: 1, priceRange: "$0.003" },
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
