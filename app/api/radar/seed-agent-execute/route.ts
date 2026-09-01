import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";
import { AGENT_EXECUTE_PATH, AGENT_EXECUTE_PRICE_USD } from "@/lib/x402-bazaar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

async function responseBody(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; }
  catch { return { raw: text.slice(0, 1000) }; }
}

export async function POST(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = `${publicOrigin(req)}${AGENT_EXECUTE_PATH}`;
  try {
    const paidFetch = await paidFetchBaseUsdcCapped(0.76);
    const response = await paidFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        task: "Confirm this PennyRail paid agent-execution route is operational. Return exactly OK followed by one short sentence.",
        context: "Internal Coinbase Bazaar discovery seed. This is not organic customer revenue.",
        max_steps: 1,
        tools: [],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
    const result = await responseBody(response);

    return NextResponse.json({
      ok: response.ok,
      stage: response.ok ? "agent-execute-bazaar-seed-complete" : "agent-execute-bazaar-seed-failed",
      url,
      paidUsd: AGENT_EXECUTE_PRICE_USD,
      paymentResponsePresent: Boolean(
        response.headers.get("payment-response") || response.headers.get("x-payment-response")
      ),
      result,
      note: "This is one internal discovery settlement, not organic revenue. Do not repeat it after success.",
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      stage: "agent-execute-bazaar-seed-failed",
      url,
      paidUsdMax: 0.76,
      error: error instanceof Error ? error.message : "agent execution seed failed",
    }, { status: 500 });
  }
}
