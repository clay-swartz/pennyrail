import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer } from "@x402/next";
import { buildPermitRailFeed } from "@/lib/permitrail";
import { permitRailHttpServer } from "@/lib/permitrail-x402";
import type { PermitRailCity, PermitRailTrade } from "@/lib/permitrail-core";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const body = await req.json().catch(() => ({}));
    const feed = await buildPermitRailFeed({
      city: (body?.city || "all") as PermitRailCity | "all",
      trade: (body?.trade || "all") as PermitRailTrade | "all",
      minScore: Number(body?.minScore ?? 35),
      maxAgeHours: Number(body?.maxAgeHours ?? 2160),
      limit: Math.min(500, Number(body?.limit ?? 500)),
    });
    const byTrade = new Map<string, number>();
    const byCity = new Map<string, number>();
    for (const signal of feed.signals) {
      byTrade.set(signal.primaryTrade, (byTrade.get(signal.primaryTrade) || 0) + 1);
      byCity.set(signal.city, (byCity.get(signal.city) || 0) + 1);
    }
    return NextResponse.json({
      ...feed,
      tier: "territory",
      analytics: {
        hot: feed.signals.filter(s => s.urgency === "hot").length,
        warm: feed.signals.filter(s => s.urgency === "warm").length,
        byTrade: Object.fromEntries(byTrade),
        byCity: Object.fromEntries(byCity),
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "PermitRail territory feed failed" }, { status: 400 });
  }
};

export const POST = withX402FromHTTPServer(handler, permitRailHttpServer);
