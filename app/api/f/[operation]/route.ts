import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";
import { FACTORY_CAPABILITIES, runFactoryOperation } from "@/lib/factory";

const known = new Set(FACTORY_CAPABILITIES.map(c => c.id));

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const prefix = "/api/f/";
    const pathname = req.nextUrl.pathname;
    const operation = decodeURIComponent(pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "").trim();
    if (!operation || !known.has(operation)) return NextResponse.json({ error: "unknown operation", operation }, { status: 404 });
    const body = await req.json();
    const result = await runFactoryOperation(operation, body?.input ?? body);
    return NextResponse.json({ operation, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "operation failed" }, { status: 400 });
  }
};

export const POST = withX402(
  handler,
  penny("Run one PennyRail machine utility.", "$0.001"),
  x402Server,
);
