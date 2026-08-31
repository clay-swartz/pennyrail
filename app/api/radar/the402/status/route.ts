import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { listThe402Services, sweepThe402Requests, the402Earnings } from "@/lib/the402";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) { return isRadarAdmin(req); }

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const participantId = process.env.THE402_PARTICIPANT_ID?.trim() || "";
  const apiKey = process.env.THE402_API_KEY?.trim() || "";
  const webhookSecret = process.env.THE402_WEBHOOK_SECRET?.trim() || "";
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      configured: false,
      participantIdPresent: Boolean(participantId),
      apiKeyPresent: false,
      webhookSecretPresent: Boolean(webhookSecret),
    });
  }
  const [earningsResult, servicesResult] = await Promise.allSettled([
    the402Earnings(apiKey),
    listThe402Services(apiKey),
  ]);
  const doSweep = req.nextUrl.searchParams.get("sweep") === "1";
  let sweep: any = null;
  if (doSweep) {
    try { sweep = await sweepThe402Requests(apiKey, 25); }
    catch (error) { sweep = { error: error instanceof Error ? error.message : String(error) }; }
  }
  return NextResponse.json({
    ok: true,
    configured: Boolean(participantId && apiKey && webhookSecret),
    participantIdPresent: Boolean(participantId),
    apiKeyPresent: true,
    webhookSecretPresent: Boolean(webhookSecret),
    services: servicesResult.status === "fulfilled" ? servicesResult.value : null,
    servicesError: servicesResult.status === "rejected" ? String(servicesResult.reason) : null,
    earnings: earningsResult.status === "fulfilled" ? earningsResult.value : null,
    earningsError: earningsResult.status === "rejected" ? String(earningsResult.reason) : null,
    sweep,
  });
}
