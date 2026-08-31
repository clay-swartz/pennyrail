import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { executeRouterTier } from "@/lib/transaction-router";
import { runFactoryOperation } from "@/lib/factory";
import type { RevenueTier } from "@/lib/revenue-engine";

function isEmptyObject(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}

async function requestInput(req: NextRequest, probeInput: unknown) {
  try {
    const body = await req.json();
    const value =
      body && typeof body === "object" && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body, "input")
        ? body.input
        : body;
    if (value == null || isEmptyObject(value)) return probeInput;
    return value;
  } catch {
    return probeInput;
  }
}

export function createRouterFrontdoor(args: {
  productId: string;
  tier: RevenueTier;
  price: string;
  description: string;
  probeInput: unknown;
}) {
  const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
    try {
      const input = await requestInput(req, args.probeInput);
      const result = await executeRouterTier(args.tier, {
        productId: args.productId,
        input,
      });
      return NextResponse.json({
        ...result,
        acquisitionSurface: "pennyrail-demand-frontdoor",
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "PennyRail execution failed" },
        { status: 400 },
      );
    }
  };

  return withX402(handler, penny(args.description, args.price), x402Server);
}

export function createFactoryFrontdoor(args: {
  operation: string;
  price: string;
  description: string;
  probeInput: unknown;
}) {
  const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
    try {
      const input = await requestInput(req, args.probeInput);
      const result = await runFactoryOperation(args.operation, input);
      return NextResponse.json({
        ok: true,
        operation: args.operation,
        priceUsd: Number(args.price.replace("$", "")),
        acquisitionSurface: "pennyrail-demand-frontdoor",
        result,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "PennyRail utility failed" },
        { status: 400 },
      );
    }
  };

  return withX402(handler, penny(args.description, args.price), x402Server);
}
