import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer } from "@x402/next";
import { bazaarProbeHttpServer } from "@/lib/x402-bazaar";

const handler = async (_req: NextRequest): Promise<NextResponse<any>> => {
  return NextResponse.json({
    ok: true,
    service: "PennyRail Bazaar probe",
    timestamp: new Date().toISOString(),
  });
};

export const GET = withX402FromHTTPServer(handler, bazaarProbeHttpServer);
