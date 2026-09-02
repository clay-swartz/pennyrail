import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/permitrail-stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const event = verifyStripeWebhook(raw, req.headers.get("stripe-signature"));
    return NextResponse.json({ received: true, type: String(event?.type || "unknown") });
  } catch (error) {
    return NextResponse.json({ received: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
