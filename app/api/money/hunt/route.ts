import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { runMoneyHunter } from "@/lib/money-hunter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Private operator trigger. Production cron runs the same hunter automatically.
// This route exists for an authenticated manual rerun/inspection without deploy.
export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runMoneyHunter();
  return NextResponse.json(result, {
    headers: { "cache-control": "no-store" },
  });
}
