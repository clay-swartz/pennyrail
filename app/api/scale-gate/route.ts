import { NextResponse } from "next/server";
import { scanPolymarketUSScaleOpportunity } from "@/lib/polymarket-us";
import { runMoneyFoundry } from "@/lib/scale-foundry";
import { batchRailEconomics } from "@/lib/batchrail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const polymarket = await scanPolymarketUSScaleOpportunity();
  const foundry = await runMoneyFoundry(polymarket);
  const batchRail = batchRailEconomics();
  const requiredFullBatchesFor1000 = Math.ceil(1000 / Math.max(0.000001, batchRail.full.minimumGuardedContributionUsd));
  return NextResponse.json({
    ok: true,
    targetNetUsdPerDay: 1000,
    generatedAt: new Date().toISOString(),
    batchRail: {
      ...batchRail,
      requiredFullBatchesFor1000NetFloorPerDay: requiredFullBatchesFor1000,
      requiredItemsAtCapacityPerDay: requiredFullBatchesFor1000 * batchRail.full.maxItems,
      status: "live-product-unproven-demand",
      note: "This is structural unit-economics capacity, not a revenue forecast. Buyer-triggered fulfillment has positive guarded contribution; demand must now be won and measured.",
    },
    polymarket,
    foundry,
  }, { headers: { "cache-control": "no-store" } });
}
