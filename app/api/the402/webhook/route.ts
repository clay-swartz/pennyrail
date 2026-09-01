import { NextRequest, NextResponse } from "next/server";
import { verifyThe402WebhookSignature } from "@/lib/the402";
import {
  fulfillThe402JobWithGapFallback,
  maybeBidThe402RequestWithGapFallback,
} from "@/lib/gap-bidder";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.THE402_API_KEY?.trim() || "";
  const webhookSecret = process.env.THE402_WEBHOOK_SECRET?.trim() || "";
  if (!apiKey || !webhookSecret) {
    return NextResponse.json({ error: "the402 provider not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!verifyThe402WebhookSignature(rawBody, req.headers, apiKey, webhookSecret)) {
    return NextResponse.json({ error: "invalid webhook signature" }, { status: 401 });
  }

  let payload: any = null;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }

  try {
    if (payload?.type === "request.created") {
      const result = await maybeBidThe402RequestWithGapFallback(payload, apiKey);
      return NextResponse.json({ ok: true, event: payload.type, result });
    }
    if (payload?.type === "job_dispatch") {
      const result = await fulfillThe402JobWithGapFallback(payload, apiKey);
      return NextResponse.json({ ok: true, event: payload.type, result });
    }
    return NextResponse.json({ ok: true, event: payload?.type || "unknown", ignored: true });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      event: payload?.type || "unknown",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
