import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { x402BazaarServer, penny } from "@/lib/x402-server";
import {
  FACTORY_CAPABILITIES,
  factorySampleInput,
  runFactoryOperation,
} from "@/lib/factory";

const known = new Set(FACTORY_CAPABILITIES.map(c => c.id));

function discoveryConfig(capability: (typeof FACTORY_CAPABILITIES)[number]) {
  const discovery = declareDiscoveryExtension({
    bodyType: "json",
    input: { input: factorySampleInput(capability.id) },
    inputSchema: {
      properties: {
        input: {
          description: capability.inputHint,
        },
      },
      required: ["input"],
    },
    output: {
      example: {
        operation: capability.id,
        result: {},
      },
    },
  });

  return {
    ...penny(capability.description, "$0.001"),
    extensions: {
      ...discovery,
    },
  };
}

// IMPORTANT: exact paths, not withX402's wildcard. Current @x402/next wildcard
// route templates fail Bazaar's matches_resource validation for Next.js.
const routeMap = Object.fromEntries(
  FACTORY_CAPABILITIES.map(capability => [
    `POST /api/f/${capability.id}`,
    discoveryConfig(capability),
  ]),
) as Record<string, any>;

const httpServer = new x402HTTPResourceServer(x402BazaarServer, routeMap);

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const prefix = "/api/f/";
    const pathname = req.nextUrl.pathname;
    const operation = decodeURIComponent(
      pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "",
    ).trim();

    if (!operation || !known.has(operation)) {
      return NextResponse.json({ error: "unknown operation", operation }, { status: 404 });
    }

    const body = await req.json();
    const result = await runFactoryOperation(operation, body?.input ?? body);
    return NextResponse.json({ operation, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "operation failed" },
      { status: 400 },
    );
  }
};

export const POST = withX402FromHTTPServer(handler, httpServer);
