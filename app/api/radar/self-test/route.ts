import { NextRequest, NextResponse } from "next/server";
import { paidFetch } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.RADAR_ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.RADAR_ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const origin = req.nextUrl.origin;
    const url = `${origin}/api/tools/text-stats?text=${encodeURIComponent("PennyRail first paid robot transaction")}`;
    const response = await paidFetch()(url);
    const body = await response.json().catch(async () => ({ raw: await response.text() }));
    if (!response.ok) {
      return NextResponse.json({ error: "paid self-test failed", status: response.status, body }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      paidUsd: 0.001,
      buyer: "CDP-managed PennyRail Radar wallet",
      sellerPayTo: process.env.PENNYRAIL_PAY_TO,
      tool: "/api/tools/text-stats",
      result: body,
      message: "PennyRail buyer paid PennyRail seller and received the protected result."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}
