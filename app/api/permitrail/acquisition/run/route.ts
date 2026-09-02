import { NextRequest, NextResponse } from "next/server";
import { runPermitRailAcquisition, verifyPermitRailAcquisitionToken } from "@/lib/permitrail-acquisition";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function origin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

async function run(req: NextRequest) {
  const slot = Number(req.nextUrl.searchParams.get("slot") || 0);
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyPermitRailAcquisitionToken(slot, token)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runPermitRailAcquisition(origin(req)), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
