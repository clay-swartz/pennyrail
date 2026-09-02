import { NextRequest, NextResponse } from "next/server";
import { portfolioStatus } from "@/lib/portfolio-engine";
import { isRadarAdmin } from "@/lib/radar-auth";
export const dynamic = "force-dynamic"; export const runtime = "nodejs"; export const maxDuration = 20;
export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json(await portfolioStatus(), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
