import { NextRequest, NextResponse } from "next/server";

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
  return null;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (process.env.X402_MODE !== "mainnet") {
    return NextResponse.json({
      error: "PennyRail is still in testnet mode.",
      next: "Set X402_MODE=mainnet in Vercel and redeploy before listing the seller publicly."
    }, { status: 400 });
  }

  const origin = publicOrigin();
  if (!origin) return NextResponse.json({ error: "Could not determine PennyRail production URL." }, { status: 500 });

  try {
    const probe = await fetch(`${origin}/.well-known/x402`, { cache: "no-store" });
    if (!probe.ok) {
      return NextResponse.json({ error: "PennyRail x402 manifest is not publicly reachable", origin, status: probe.status }, { status: 502 });
    }

    const res = await fetch("https://agent402.tools/api/index/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin }),
      cache: "no-store",
    });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch {}

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      origin,
      marketplace: "Agent402 open x402 index",
      response: body,
      note: res.ok ? "PennyRail was submitted for marketplace probing/indexing." : "Agent402 rejected or could not probe the listing; response included above."
    }, { status: res.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error", origin }, { status: 500 });
  }
}
