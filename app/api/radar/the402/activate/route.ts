import { NextRequest, NextResponse } from "next/server";
import { activateThe402Provider, sweepThe402Requests } from "@/lib/the402";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const participantId = process.env.THE402_PARTICIPANT_ID?.trim() || "";
  const apiKey = process.env.THE402_API_KEY?.trim() || "";
  const webhookSecret = process.env.THE402_WEBHOOK_SECRET?.trim() || "";
  if (!participantId || !apiKey || !webhookSecret) {
    return NextResponse.json({
      error: "the402 credentials are not loaded in Production yet.",
      missing: [
        !participantId ? "THE402_PARTICIPANT_ID" : null,
        !apiKey ? "THE402_API_KEY" : null,
        !webhookSecret ? "THE402_WEBHOOK_SECRET" : null,
      ].filter(Boolean),
      hint: "Add the registration credentials to Vercel Production and redeploy, then retry.",
    }, { status: 409 });
  }
  const webhookUrl = `${publicOrigin(req)}/api/the402/webhook`;
  try {
    const activation = await activateThe402Provider({ participantId, apiKey, webhookUrl });
    let sweep: any = null;
    try { sweep = await sweepThe402Requests(apiKey, 25); }
    catch (error) { sweep = { error: error instanceof Error ? error.message : String(error) }; }
    return NextResponse.json({
      ok: true,
      stage: "active",
      webhookUrl,
      servicesLive: Array.isArray(activation.services) ? activation.services.length : null,
      createdThisRun: activation.createdCount,
      requestNotifications: activation.notifications,
      initialRequestSweep: sweep,
      note: "PennyRail is now listed for direct purchases and subscribed to request.created for automatic bidding on matching work up to the unverified $25 request ceiling.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "the402 activation failed",
      stage: "activate",
    }, { status: 500 });
  }
}
