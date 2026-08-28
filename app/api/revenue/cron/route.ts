import { NextResponse } from "next/server";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";

export const dynamic = "force-dynamic";

// Safe to invoke from Vercel Cron: this route spends $0 and only refreshes the
// shared daily demand/supply snapshot. Full opportunity details stay behind the
// admin route.
export async function GET() {
  const audit = await getCachedRevenueAudit();
  return NextResponse.json({
    ok: true,
    generatedAt: audit.generatedAt,
    mode: audit.mode,
    sources: audit.sources,
    portfolio: audit.portfolio,
    opportunityCounts: {
      autoLive: audit.autoLive?.length || 0,
      unresolved: audit.unresolved?.length || 0,
    },
    automaticIntelSpendUsd: 0,
  });
}
