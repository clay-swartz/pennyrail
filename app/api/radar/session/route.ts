import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin, isRadarToken, RADAR_SESSION_COOKIE, RADAR_SESSION_MAX_AGE_SECONDS, radarSessionValue } from "@/lib/radar-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isRadarAdmin(req) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try { body = await req.json(); } catch {}
  const token = String(body?.token || req.headers.get("x-admin-token") || "");
  if (!isRadarToken(token)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const response = NextResponse.json({ ok: true, authenticated: true });
  response.cookies.set(RADAR_SESSION_COOKIE, radarSessionValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: RADAR_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, authenticated: false });
  response.cookies.set(RADAR_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
