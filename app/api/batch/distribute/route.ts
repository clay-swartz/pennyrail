import { NextRequest, NextResponse } from "next/server";
import { distributeBatchRail, verifyBatchRailDistributionToken } from "@/lib/batchrail-distribution";

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
  if (!verifyBatchRailDistributionToken(slot, token)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await distributeBatchRail(origin(req)), { headers: { "cache-control": "no-store" } });
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
