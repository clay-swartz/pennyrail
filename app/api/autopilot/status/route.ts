import { NextRequest, NextResponse } from "next/server";
import { autopilotStatus } from "@/lib/autopilot";
import { isRadarAdmin } from "@/lib/radar-auth";
import { mode, network, payTo } from "@/lib/x402-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await autopilotStatus();
    const normalizedPayTo = String(payTo || "").trim();
    const isBaseMainnet = network === "eip155:8453";

    return NextResponse.json(
      {
        ...result,
        paymentRail: {
          mode,
          network,
          asset: "USDC",
          payTo: normalizedPayTo,
          explorerUrl:
            isBaseMainnet && /^0x[0-9a-fA-F]{40}$/.test(normalizedPayTo)
              ? `https://basescan.org/address/${normalizedPayTo}`
              : null,
        },
      },
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      {
        status: 500,
        headers: { "cache-control": "no-store" },
      },
    );
  }
}
