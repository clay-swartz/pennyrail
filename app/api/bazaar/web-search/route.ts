import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer } from "@x402/next";
import { bazaarWebSearchHttpServer } from "@/lib/x402-bazaar";
import { executeRouterTier } from "@/lib/transaction-router";

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const body = await req.json();
    const input = body?.input ?? body;
    const result = await executeRouterTier("premium", {
      productId: "web.search",
      input,
    });
    return NextResponse.json({
      ...result,
      discoverySurface: "coinbase-bazaar",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bazaar web search failed" },
      { status: 400 },
    );
  }
};

export const POST = withX402FromHTTPServer(handler, bazaarWebSearchHttpServer);
