import { NextRequest, NextResponse } from "next/server";
import { buildPermitRailFeed } from "@/lib/permitrail";
import type { PermitRailCity, PermitRailTrade } from "@/lib/permitrail-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const expected = process.env.RAPIDAPI_PROXY_SECRET?.trim() || "";
  if (!expected) return false;
  return req.headers.get("x-rapidapi-proxy-secret") === expected || req.headers.get("x-permitrail-secret") === expected;
}

async function run(req: NextRequest) {
  if (!process.env.RAPIDAPI_PROXY_SECRET?.trim()) {
    return NextResponse.json({ ok: false, configured: false, error: "RapidAPI provider secret is not configured yet." }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let body: any = {};
  if (req.method === "POST") body = await req.json().catch(() => ({}));
  else body = Object.fromEntries(req.nextUrl.searchParams.entries());
  const feed = await buildPermitRailFeed({
    city: (body?.city || "all") as PermitRailCity | "all",
    trade: (body?.trade || "all") as PermitRailTrade | "all",
    minScore: Number(body?.minScore ?? 45),
    maxAgeHours: Number(body?.maxAgeHours ?? 720),
    limit: Math.min(500, Number(body?.limit ?? 100)),
  });
  return NextResponse.json(feed, {
    headers: {
      "cache-control": "no-store",
      "X-RapidAPI-Billing": `Signals=${feed.signals.length}`,
    },
  });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
