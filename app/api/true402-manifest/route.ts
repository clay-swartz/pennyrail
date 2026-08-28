import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function cleanOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const origin = cleanOrigin(req);
  const payTo = process.env.PENNYRAIL_PAY_TO || "";

  // true402's service manifest describes one purchasable service endpoint.
  // PennyRail's true402 listing therefore points to the generic Factory
  // dispatcher ($0.003/run), while Agent402 continues indexing all individual
  // $0.001 factory tollbooths from OpenAPI.
  return NextResponse.json({
    x402: "1.0",
    name: "PennyRail",
    capabilities: [
      "machine-utilities",
      "text",
      "json",
      "url",
      "numbers",
      "time",
      "encoding",
      "validation",
      "lookup"
    ],
    pricing: {
      currency: "USDC",
      base: "0.003",
      unit: "request"
    },
    payment: {
      address: payTo,
      chain: "base",
      facilitator: process.env.X402_FACILITATOR_URL || "https://api.cdp.coinbase.com/platform/v2/x402"
    },
    endpoint: `${origin}/api/factory/run`
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
