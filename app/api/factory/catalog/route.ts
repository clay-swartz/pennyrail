import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES, matchCapability } from "@/lib/factory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const match = q ? matchCapability(q) : null;
  return NextResponse.json({
    service: "PennyRail Factory",
    priceUsdPerRun: 0.001,
    capabilityCount: FACTORY_CAPABILITIES.length,
    match: match ? { operation: match.capability.id, endpoint: `/api/f/${match.capability.id}`, priceUsd: 0.001, score: match.score, title: match.capability.title, description: match.capability.description, inputHint: match.capability.inputHint } : null,
    capabilities: q ? undefined : FACTORY_CAPABILITIES.map(c => ({ operation:c.id, endpoint:`/api/f/${c.id}`, priceUsd:0.001, title:c.title, description:c.description, inputHint:c.inputHint, network:!!c.network })),
  }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
}
