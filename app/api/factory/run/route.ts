import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";
import { runFactoryOperation } from "@/lib/factory";

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const body = await req.json();
    const operation = typeof body?.operation === "string" ? body.operation.trim() : "";
    if (!operation) return NextResponse.json({ error: "operation is required; see /api/factory/catalog" }, { status: 400 });
    const result = await runFactoryOperation(operation, body?.input);
    return NextResponse.json({ operation, result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "factory operation failed" }, { status: 400 });
  }
};

export const POST = withX402(
  handler,
  penny("Run one PennyRail Factory micro-capability. Discover operations at /api/factory/catalog.", "$0.003"),
  x402Server,
);
