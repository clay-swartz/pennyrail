import { NextRequest, NextResponse } from "next/server";
import { paidFetch } from "@/lib/radar-buyer";
import { FACTORY_CAPABILITIES, factorySampleInput } from "@/lib/factory";

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
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let cursor = 0;
  try {
    const body = await req.json().catch(() => ({}));
    cursor = Math.max(0, Math.trunc(Number(body?.cursor || 0)));
  } catch {}

  const batchSize = 6;
  const slice = FACTORY_CAPABILITIES.slice(cursor, cursor + batchSize);
  const origin = publicOrigin();
  const pf = await paidFetch();
  const results: any[] = [];

  for (const capability of slice) {
    const url = `${origin}/api/f/${encodeURIComponent(capability.id)}`;
    try {
      const response = await pf(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: factorySampleInput(capability.id) }),
      });
      const text = await response.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch {}
      results.push({
        operation: capability.id,
        ok: response.ok,
        status: response.status,
        body: response.ok ? body : undefined,
        error: response.ok ? undefined : (body || text.slice(0, 300)),
      });
    } catch (error) {
      results.push({
        operation: capability.id,
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "seed failed",
      });
    }
  }

  const nextCursor = cursor + slice.length < FACTORY_CAPABILITIES.length
    ? cursor + slice.length
    : null;

  return NextResponse.json({
    ok: results.every(r => r.ok),
    cursor,
    nextCursor,
    batchSize: slice.length,
    totalCapabilities: FACTORY_CAPABILITIES.length,
    estimatedSpendUsdThisBatch: Number((slice.length * 0.001).toFixed(3)),
    results,
    note: nextCursor === null
      ? "Bazaar seed pass completed across the full factory inventory."
      : "Call again with nextCursor to continue seeding.",
  });
}
