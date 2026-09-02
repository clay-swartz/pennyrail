import { NextResponse } from "next/server";
import { batchRailActivationState, buyerBaseUsdcBalanceUsd } from "@/lib/batchrail-activation";
import { batchRailDistributionState } from "@/lib/batchrail-distribution";
import { radarBuyerAddress } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET() {
  const [activation, distribution, address, balance] = await Promise.allSettled([
    batchRailActivationState(),
    batchRailDistributionState(),
    radarBuyerAddress(),
    buyerBaseUsdcBalanceUsd(),
  ]);
  const value = <T,>(row: PromiseSettledResult<T>, fallback: any = null) => row.status === "fulfilled" ? row.value : fallback;
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    activation: value(activation),
    distribution: value(distribution),
    buyerAddress: value(address),
    buyerUsdcBalanceUsd: value(balance),
  }, { headers: { "cache-control": "no-store" } });
}
