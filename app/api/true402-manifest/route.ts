import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";

export const dynamic = "force-dynamic";

function cleanOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const origin = cleanOrigin(req);
  const payTo = process.env.PENNYRAIL_PAY_TO || "";

  return NextResponse.json({
    x402: "1.0",
    name: "PennyRail",
    description: "50 tiny deterministic pay-per-call utilities for autonomous software.",
    capabilities: [
      "machine-utilities",
      "text",
      "json",
      "url",
      "numbers",
      "time",
      "encoding",
      "validation",
      "lookup",
    ],
    pricing: {
      currency: "USDC",
      base: 0.001,
      unit: "request",
    },
    payment: {
      address: payTo,
      chain: "base",
      facilitator: process.env.X402_FACILITATOR_URL || "https://api.cdp.coinbase.com/platform/v2/x402",
    },
    endpoint: `${origin}/api/f/{operation}`,
    openapi: `${origin}/openapi.json`,
    manifest: `${origin}/.well-known/x402`,
    toolCount: FACTORY_CAPABILITIES.length + 3,
    tools: FACTORY_CAPABILITIES.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      endpoint: `${origin}/api/f/${c.id}`,
      method: "POST",
      price: "$0.001",
    })),
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
