import { NextRequest, NextResponse } from "next/server";
import { autopilotStatus } from "@/lib/autopilot";
import { isRadarAdmin } from "@/lib/radar-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await autopilotStatus();
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
