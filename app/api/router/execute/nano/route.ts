import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { executeRouterTier } from "@/lib/transaction-router";

export const POST = withX402(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      return NextResponse.json(await executeRouterTier("nano", body));
    } catch (error) {
      return NextResponse.json({ error:error instanceof Error ? error.message : "router execution failed" }, { status:400 });
    }
  },
  penny("PennyRail universal router execution: nano capability.", "$0.001"),
  x402Server,
);
