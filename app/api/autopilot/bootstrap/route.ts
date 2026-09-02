import { NextResponse } from "next/server";
import { bootstrapAutopilot } from "@/lib/autopilot";
import { runPortfolioTick } from "@/lib/portfolio-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await bootstrapAutopilot();
    let portfolio: any;
    try {
      portfolio = await runPortfolioTick(Math.floor(Date.now() / 1000));
    } catch (error) {
      portfolio = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    return NextResponse.json({ ...result, portfolio }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61_PORTFOLIO_V65",
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
