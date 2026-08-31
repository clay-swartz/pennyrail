import { NextRequest, NextResponse } from "next/server";
import { findRouterCandidates } from "@/lib/transaction-router";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const intent = req.nextUrl.searchParams.get("q")?.trim() || req.nextUrl.searchParams.get("intent")?.trim() || "";
  if (!intent) return NextResponse.json({ ok:false, error:"q or intent is required" }, { status:400 });
  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 8)));
  const candidates = findRouterCandidates(intent, limit);
  return NextResponse.json({
    ok:true,
    service:"PennyRail Transaction Router",
    mode:"free-discovery",
    intent,
    candidates,
    next: candidates.length ? "POST the chosen productId to /api/router/quote, then pay only the returned executeUrl." : "No safe local match yet.",
  }, { headers:{"cache-control":"public, max-age=30, s-maxage=60"} });
}
