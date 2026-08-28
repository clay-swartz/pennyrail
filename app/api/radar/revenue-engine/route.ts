import { NextRequest, NextResponse } from "next/server";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) && req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const audit = await getCachedRevenueAudit();
    return NextResponse.json(audit);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Revenue Engine audit failed" }, { status: 500 });
  }
}
