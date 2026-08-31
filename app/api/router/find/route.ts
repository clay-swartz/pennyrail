import { NextRequest, NextResponse } from "next/server";
import { findRouterCandidates } from "@/lib/transaction-router";
import { recordOwnedFindSignal } from "@/lib/radar-owned-signals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const intent = req.nextUrl.searchParams.get("q")?.trim() || req.nextUrl.searchParams.get("intent")?.trim() || "";
  if (!intent) return NextResponse.json({ ok:false, error:"q or intent is required" }, { status:400 });

  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 8)));
  const candidates = findRouterCandidates(intent, limit);
  const topScore = Number(candidates[0]?.score || 0);

  // Owned Radar signal: a no-match or weak match should never disappear.
  // Probe current external supply/pricing immediately and persist it to the
  // optional existing Supabase Radar snapshot table when configured.
  const weak = candidates.length === 0 || topScore < 56;
  const radarSignal = weak
    ? await recordOwnedFindSignal({ intent, topScore, candidateCount: candidates.length })
    : null;

  return NextResponse.json({
    ok:true,
    service:"PennyRail Transaction Router",
    mode:"free-discovery",
    intent,
    candidates,
    radarSignal,
    next: candidates.length
      ? "POST the chosen productId to /api/router/quote, then pay only the returned executeUrl."
      : "No safe local match yet. Radar recorded the gap and checked outside supply.",
  }, { headers:{"cache-control":"public, max-age=30, s-maxage=60"} });
}
