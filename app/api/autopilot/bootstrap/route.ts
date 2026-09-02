import { NextResponse } from "next/server";
import { bootstrapAutopilot } from "@/lib/autopilot";
import { portfolioStatus, runPortfolioTick } from "@/lib/portfolio-engine";
import { activateBatchRailDiscovery } from "@/lib/batchrail-activation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

export async function GET() {
  try {
    const result = await bootstrapAutopilot();

    let batchRailActivation: any = { ok: false, activated: false, spentUsd: 0, stage: "budget-check" };
    try {
      const before = await portfolioStatus();
      const budget = before?.state?.budget || {};
      const availableToday = Number(budget.availableTodayUsd ?? 1);
      const availableWeek = Number(budget.availableWeekUsd ?? 5);
      if (availableToday + 1e-9 >= 0.05 && availableWeek + 1e-9 >= 0.05) {
        batchRailActivation = await activateBatchRailDiscovery(origin());
      } else {
        batchRailActivation = { ok: false, activated: false, spentUsd: 0, stage: "budget-blocked", error: "The one-time $0.05 BatchRail discovery seed would exceed the current experiment budget." };
      }
    } catch (error) {
      batchRailActivation = { ok: false, activated: false, spentUsd: 0, stage: "activation", error: error instanceof Error ? error.message : String(error) };
    }

    let portfolio: any;
    try {
      // Run after the activation attempt so a successful one-time $0.05 seed is
      // immediately reconciled into the experiment/cost ledger.
      portfolio = await runPortfolioTick(Math.floor(Date.now() / 1000));
    } catch (error) {
      portfolio = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    return NextResponse.json({ ...result, portfolio, batchRailActivation }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61_PORTFOLIO_V67", error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
