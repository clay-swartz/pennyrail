import { NextResponse } from "next/server";
import { buildPermitRailFeed } from "@/lib/permitrail";
import { maskAddress } from "@/lib/permitrail-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 40;

export async function GET() {
  try {
    const feed = await buildPermitRailFeed({ minScore: 55, maxAgeHours: 30 * 24, limit: 8 });
    return NextResponse.json({
      ok: feed.ok,
      generatedAt: feed.generatedAt,
      count: feed.signals.length,
      signals: feed.signals.map(s => ({
        city: s.city,
        primaryTrade: s.primaryTrade,
        adjacentTrades: s.adjacentTrades.slice(0, 4),
        score: s.score,
        urgency: s.urgency,
        ageHours: s.ageHours,
        estimatedOpportunityValueUsd: s.estimatedOpportunityValueUsd,
        valueBasis: s.valueBasis,
        permitType: s.permitType,
        address: maskAddress(s.address),
        sourceKind: s.sourceKind,
        sourceName: s.sourceName,
      })),
      note: "Free sample masks exact street numbers. Paid feeds return full public-record fields and source evidence.",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
