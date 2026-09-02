import { NextRequest, NextResponse } from "next/server";
import { runPortfolioTick, verifyPortfolioToken } from "@/lib/portfolio-engine";
export const dynamic = "force-dynamic"; export const runtime = "nodejs"; export const maxDuration = 60;
async function run(req: NextRequest) {
  const slot = Number(req.nextUrl.searchParams.get("slot")); const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyPortfolioToken(slot, token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let fallback: string | null = null; if (req.method === "POST") { try { const body = await req.json(); fallback = typeof body?.state === "string" ? body.state : null; } catch {} }
  try { return NextResponse.json(await runPortfolioTick(slot, fallback), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
export async function GET(req: NextRequest) { return run(req); } export async function POST(req: NextRequest) { return run(req); }
