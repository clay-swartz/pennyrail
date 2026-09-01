import { NextRequest, NextResponse } from "next/server";
import { verifyThe402WebhookSignature } from "@/lib/the402";
import {
  getThe402RuntimeCredentials,
  isAuthorizedThe402BootstrapRequest,
} from "@/lib/the402-runtime";
import {
  fulfillThe402JobWithGapFallback,
  maybeBidThe402RequestWithGapFallback,
} from "@/lib/gap-bidder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${production
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")}`;
  }
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  const envConfigured = Boolean(
    process.env.THE402_API_KEY?.trim() &&
    process.env.THE402_WEBHOOK_SECRET?.trim() &&
    process.env.THE402_PARTICIPANT_ID?.trim(),
  );

  // Dynamic credentials require the private bootstrap token embedded in the
  // webhook URL PennyRail registered with the402. Reject arbitrary callers
  // before any paid credential recovery can occur.
  if (!envConfigured && !isAuthorizedThe402BootstrapRequest(req)) {
    return NextResponse.json(
      { error: "invalid webhook bootstrap" },
      { status: 401 },
    );
  }

  let credentials;
  try {
    credentials = await getThe402RuntimeCredentials(publicOrigin(req));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "the402 provider credential recovery failed",
      },
      { status: 503 },
    );
  }

  const rawBody = await req.text();

  if (
    !verifyThe402WebhookSignature(
      rawBody,
      req.headers,
      credentials.api_key,
      credentials.webhook_secret,
    )
  ) {
    return NextResponse.json(
      { error: "invalid webhook signature" },
      { status: 401 },
    );
  }

  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  try {
    if (payload?.type === "request.created") {
      const result = await maybeBidThe402RequestWithGapFallback(
        payload,
        credentials.api_key,
      );
      return NextResponse.json({
        ok: true,
        event: payload.type,
        result,
      });
    }

    if (payload?.type === "job_dispatch") {
      const result = await fulfillThe402JobWithGapFallback(
        payload,
        credentials.api_key,
      );
      return NextResponse.json({
        ok: true,
        event: payload.type,
        result,
      });
    }

    return NextResponse.json({
      ok: true,
      event: payload?.type || "unknown",
      ignored: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        event: payload?.type || "unknown",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
