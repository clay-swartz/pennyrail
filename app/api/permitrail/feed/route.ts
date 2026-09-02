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
      minScore: Number(body?.minScore ?? 45),
      maxAgeHours: Number(body?.maxAgeHours ?? 720),
      limit: Math.min(100, Number(body?.limit ?? 100)),
    });
    return NextResponse.json(feed, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "PermitRail feed failed" }, { status: 400 });
  }
};

export const POST = withX402FromHTTPServer(handler, permitRailHttpServer);
