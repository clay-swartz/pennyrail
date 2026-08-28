import { NextRequest, NextResponse } from "next/server";
import { paidFetch } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function publicOrigin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = `${publicOrigin()}/api/bazaar-probe`;
  try {
    const pf = await paidFetch();
    const response = await pf(url, { method: "GET" });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch {}

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      spentUsd: response.ok ? 0.001 : 0,
      paymentResponsePresent: Boolean(response.headers.get("payment-response")),
      body: body ?? text.slice(0, 500),
      note: response.ok
        ? "Bazaar probe settled successfully without touching the 47 production factory routes."
        : "Bazaar probe failed; production factory inventory remains on the proven v21 payment wrapper.",
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Bazaar probe failed",
      url,
      note: "Production factory inventory remains unchanged and buyable.",
    }, { status: 500 });
  }
}
