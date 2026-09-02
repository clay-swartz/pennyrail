import { NextResponse } from "next/server";
import { permitRailAcquisitionPublicStatus } from "@/lib/permitrail-acquisition";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET() {
  try {
    return NextResponse.json(await permitRailAcquisitionPublicStatus(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
