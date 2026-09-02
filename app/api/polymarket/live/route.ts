import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import {
  cancelAllPolymarketUSOrders,
  cancelPolymarketUSOrder,
  placePolymarketUSOrder,
  polymarketUSConfig,
  polymarketUSReconcile,
  previewPolymarketUSOrder,
} from "@/lib/polymarket-us";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cfg = polymarketUSConfig();
  if (!cfg.configured) {
    return NextResponse.json({
      ok: true,
      capability: cfg,
      note: "Polymarket US live adapter is installed. No credentials or capital are configured, and POLYMARKET_US_LIVE remains false by default.",
    });
  }
  try {
    return NextResponse.json({ ok: true, reconciliation: await polymarketUSReconcile() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isRadarAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "preview") return NextResponse.json({ ok: true, result: await previewPolymarketUSOrder(body?.order || {}) });
    if (action === "place") return NextResponse.json({ ok: true, result: await placePolymarketUSOrder(body?.order || {}) });
    if (action === "cancel") return NextResponse.json({ ok: true, result: await cancelPolymarketUSOrder(String(body?.orderId || ""), String(body?.marketSlug || "")) });
    if (action === "cancel_all") return NextResponse.json({ ok: true, result: await cancelAllPolymarketUSOrders(body?.marketSlug ? String(body.marketSlug) : null) });
    if (action === "reconcile") return NextResponse.json({ ok: true, result: await polymarketUSReconcile() });
    return NextResponse.json({ error: "action must be preview, place, cancel, cancel_all, or reconcile" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
