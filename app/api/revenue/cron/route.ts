import { NextResponse } from "next/server";
import { runMoneyHunter } from "@/lib/money-hunter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runMoneyHunter();
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      mode: "AUTONOMOUS_MONEY_HUNTER_V54",
      error: error instanceof Error ? error.message : String(error),
    }, {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }
}
