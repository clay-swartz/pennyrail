import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer } from "@x402/next";
import { BATCHRAIL_FULL_MAX_ITEMS, batchRailHttpServer, runBatchRail } from "@/lib/batchrail";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const body = await req.json();
    return NextResponse.json(await runBatchRail(body?.input ?? body, BATCHRAIL_FULL_MAX_ITEMS), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "BatchRail failed" }, { status: 400 });
  }
};

export const POST = withX402FromHTTPServer(handler, batchRailHttpServer);
