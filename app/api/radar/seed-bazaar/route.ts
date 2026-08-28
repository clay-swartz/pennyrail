import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

/**
 * Legacy v22 endpoint.
 *
 * Kept intentionally so full-folder GitHub uploads overwrite the old
 * seed-bazaar implementation instead of leaving a stale file behind.
 * Bazaar testing now lives at /api/radar/test-bazaar and is isolated to
 * one $0.001 probe so production inventory cannot be broken by discovery
 * experiments.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: false,
    deprecated: true,
    endpoint: "/api/radar/seed-bazaar",
    replacement: "/api/radar/test-bazaar",
    note: "Bulk Bazaar seeding is disabled. Use the isolated Test Bazaar probe from the private PennyRail operator page.",
  }, { status: 410 });
}
