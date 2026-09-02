import { NextResponse } from "next/server";
import { runMoneyHunter } from "@/lib/money-hunter";
import { runPortfolioTick } from "@/lib/portfolio-engine";
export const dynamic = "force-dynamic"; export const maxDuration = 60;
export async function GET() {
  try {
    const [hunter, portfolio] = await Promise.allSettled([runMoneyHunter(), runPortfolioTick(Math.floor(Date.now() / 1000))]);
    return NextResponse.json({
      ok: hunter.status === "fulfilled" || portfolio.status === "fulfilled",
      mode: "PORTFOLIO_ENGINE_V65",
      hunter: hunter.status === "fulfilled" ? hunter.value : { ok: false, error: String(hunter.reason) },
      portfolio: portfolio.status === "fulfilled" ? portfolio.value : { ok: false, error: String(portfolio.reason) },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, mode: "PORTFOLIO_ENGINE_V65", error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
