import { NextResponse } from "next/server";
import { runKalshiPaperModel } from "@/lib/kalshi-paper";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const result = await runKalshiPaperModel();
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
