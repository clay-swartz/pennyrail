import { NextRequest, NextResponse } from "next/server";
import { paidFetch } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function parseBodyOnce(raw: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.RADAR_ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.RADAR_ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const origin = req.nextUrl.origin;
    const url = `${origin}/api/tools/text-stats?text=${encodeURIComponent("PennyRail first paid robot transaction")}`;
    const pf = await paidFetch();
    const response = await pf(url);

    // A Fetch Response body is a one-shot stream. Read it exactly once, then parse
    // the saved text so diagnostics never mask the real x402/server response.
    const raw = await response.text();
    const body = parseBodyOnce(raw);

    const paymentResponse =
      response.headers.get("payment-response") ??
      response.headers.get("x-payment-response") ??
      response.headers.get("payment-signature") ??
      null;

    const diagnostics = {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      paymentResponsePresent: Boolean(paymentResponse),
    };

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "paid self-test failed",
          diagnostics,
          body,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      paidUsd: 0.001,
      buyer: "CDP-managed PennyRail Radar wallet",
      sellerPayTo: process.env.PENNYRAIL_PAY_TO,
      tool: "/api/tools/text-stats",
      diagnostics,
      result: body,
      message: "PennyRail buyer paid PennyRail seller and received the protected result.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
        stage: "self-test fetch/payment",
      },
      { status: 500 },
    );
  }
}
