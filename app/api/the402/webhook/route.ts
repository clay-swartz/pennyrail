import { NextRequest, NextResponse } from "next/server";
import { fulfillThe402Job, maybeBidThe402Request, verifyThe402WebhookSignature } from "@/lib/the402";

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
      const result = await maybeBidThe402Request(payload, apiKey);
      return NextResponse.json({ ok: true, event: payload.type, result });
    }
    if (payload?.type === "job_dispatch") {
      const result = await fulfillThe402Job(payload, apiKey);
      return NextResponse.json({ ok: true, event: payload.type, result });
    }
    return NextResponse.json({ ok: true, event: payload?.type || "unknown", ignored: true });
  } catch (error) {
    // the402 retries failed deliveries only a small number of times. Surface a
    // transient handler failure as non-2xx so a paid job/request gets another
    // chance instead of being silently dropped. Bid placement is idempotent.
    return NextResponse.json({
      ok: false,
      event: payload?.type || "unknown",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
