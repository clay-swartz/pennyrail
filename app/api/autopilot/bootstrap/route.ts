import { NextResponse } from "next/server";
import { bootstrapAutopilot } from "@/lib/autopilot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await bootstrapAutopilot();
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
