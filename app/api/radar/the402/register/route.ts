import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { registerThe402Provider } from "@/lib/the402";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) { return isRadarAdmin(req); }

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const origin = publicOrigin(req);
  const webhookUrl = `${origin}/api/the402/webhook`;
  try {
    const credentials = await registerThe402Provider(webhookUrl);
    return NextResponse.json({
      ok: true,
      stage: "registered",
      paidUsdMax: 0.01,
      webhookUrl,
      credentials,
      next: {
        action: "Add these three values to Vercel Production environment variables, then redeploy once.",
        environmentVariables: {
          THE402_PARTICIPANT_ID: credentials.participant_id,
          THE402_API_KEY: credentials.api_key,
          THE402_WEBHOOK_SECRET: credentials.webhook_secret,
        },
        then: "Return here and click Activate outbound sales. Activation/listing/subscription calls are free.",
      },
      warning: "These credentials are secrets. Do not commit THE402_API_KEY or THE402_WEBHOOK_SECRET to GitHub.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "the402 registration failed",
      stage: "register",
      paidUsdMax: 0.01,
    }, { status: 500 });
  }
}
