import { NextRequest, NextResponse } from "next/server";
import { runRevenueProduct, type RevenueTier } from "@/lib/revenue-engine";
import { distributorSecret } from "@/lib/portfolio-distribution";
export const dynamic = "force-dynamic"; export const runtime = "nodejs"; export const maxDuration = 60;
function allowedTier(v: string): v is RevenueTier { return ["nano", "mini", "network", "micro", "intel", "standard", "premium", "skill", "analyst"].includes(v); }
export async function POST(req: NextRequest, ctx: { params: Promise<{ tier: string; slug: string }> }) {
  const supplied = req.headers.get("x-pennyrail-distributor") || ""; const expected = distributorSecret();
  if (!expected || supplied !== expected) return NextResponse.json({ error: "unauthorized distributor" }, { status: 401 });
  const { tier, slug } = await ctx.params; if (!allowedTier(tier)) return NextResponse.json({ error: "invalid tier" }, { status: 400 });
  try { const body = await req.json(); return NextResponse.json(await runRevenueProduct(decodeURIComponent(slug), tier, body?.input ?? body)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
