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
  return "https://pennyrail.vercel.app";
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const origin = publicOrigin();
  try {
    const manifestCheck = await fetch(`${origin}/.well-known/x402-service.json`, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!manifestCheck.ok) {
      return NextResponse.json({
        error: "true402 manifest is not publicly reachable",
        status: manifestCheck.status,
        manifest: `${origin}/.well-known/x402-service.json`,
      }, { status: 502 });
    }

    const response = await fetch("https://true402.dev/api/v1/services", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ url: origin }),
      cache: "no-store",
    });
    const text = await response.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch {}

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      marketplace: "true402",
      origin,
      manifest: `${origin}/.well-known/x402-service.json`,
      response: body,
      note: response.ok
        ? "PennyRail submitted to true402 for machine discovery."
        : "true402 rejected the submission; response included above.",
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "true402 registration failed",
      marketplace: "true402",
      origin,
    }, { status: 500 });
  }
}
