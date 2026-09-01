import { NextRequest, NextResponse } from "next/server";
import {
  runAutopilotTick,
  verifyAutopilotToken,
} from "@/lib/autopilot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const slot = Number(req.nextUrl.searchParams.get("slot") || "");
  const token = req.nextUrl.searchParams.get("token") || "";

  if (!verifyAutopilotToken(slot, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    let fallbackState: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        fallbackState =
          typeof body?.state === "string" ? body.state : null;
      } catch {}
    }

    const result = await runAutopilotTick(slot, fallbackState);
    return NextResponse.json(result, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}

export const GET = handle;
export const POST = handle;
