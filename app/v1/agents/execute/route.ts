import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer } from "@x402/next";
import { agentExecuteHttpServer, AGENT_EXECUTE_PRICE_USD } from "@/lib/x402-bazaar";
import { runOpenAiAgentExecution } from "@/lib/revenue-upstreams";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const input = await req.json();
    const result = await runOpenAiAgentExecution(input);
    return NextResponse.json({
      ...result,
      priceUsd: AGENT_EXECUTE_PRICE_USD,
      acquisitionSurface: "observed-paid-flow-clone",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "agent execution failed" },
      { status: 400 },
    );
  }
};

export const POST = withX402FromHTTPServer(handler, agentExecuteHttpServer);
