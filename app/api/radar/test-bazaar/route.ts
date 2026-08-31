import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = `${publicOrigin(req)}/api/bazaar/web-search`;

  try {
    const paidFetch = await paidFetchBaseUsdcCapped(0.02);
    const response = await paidFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        query: "latest x402 agent commerce news",
        count: 3,
        freshness: "pw",
      }),
      cache: "no-store",
    });

    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch {}

    return NextResponse.json({
      ok: response.ok,
      stage: response.ok ? "settled-for-bazaar-indexing" : "seed-failed",
      status: response.status,
      url,
      paidUsdMax: 0.02,
      paymentResponsePresent: Boolean(
        response.headers.get("payment-response") ||
        response.headers.get("x-payment-response")
      ),
      result: body ?? text.slice(0, 1000),
      note: response.ok
        ? "Internal $0.02 distribution seed completed. This is not organic customer revenue. Coinbase/CDP can now ingest the route's Bazaar discovery metadata from this settlement."
        : "Bazaar seed failed. Existing PennyRail production routes were not modified by this isolated endpoint.",
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Bazaar seed failed",
      stage: "seed",
      paidUsdMax: 0.02,
      url,
      note: "Existing PennyRail production routes remain untouched.",
    }, { status: 500 });
  }
}
