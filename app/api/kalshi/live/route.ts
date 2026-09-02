import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { cancelAllKalshiOrders, cancelKalshiOrder, kalshiLiveConfig, kalshiReconcile, placeKalshiOrder } from "@/lib/kalshi-live";
export const dynamic = "force-dynamic"; export const runtime = "nodejs"; export const maxDuration = 30;
function auth(req: NextRequest) { return isRadarAdmin(req); }
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cfg = kalshiLiveConfig(); if (!cfg.configured) return NextResponse.json({ ok: true, capability: { live: cfg.live, configured: false, armed: false, killSwitch: cfg.killSwitch, maxCapitalUsd: cfg.maxCapitalUsd }, note: "Live execution adapter is installed but credentials are not configured." });
  try { return NextResponse.json({ ok: true, reconciliation: await kalshiReconcile() }); } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 }); }
}
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json(); const action = String(body?.action || "");
    if (action === "place") return NextResponse.json({ ok: true, result: await placeKalshiOrder(body?.order || {}) });
    if (action === "cancel") return NextResponse.json({ ok: true, result: await cancelKalshiOrder(String(body?.orderId || "")) });
    if (action === "cancel_all") return NextResponse.json({ ok: true, result: await cancelAllKalshiOrders() });
    if (action === "reconcile") return NextResponse.json({ ok: true, result: await kalshiReconcile() });
    return NextResponse.json({ error: "action must be place, cancel, cancel_all, or reconcile" }, { status: 400 });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
}
