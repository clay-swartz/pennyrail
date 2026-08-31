import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";

function sort(v: any): any {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => {
      o[k] = sort(v[k]);
      return o;
    }, {} as any);
  }
  return v;
}

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  let input: any;
  let inputDefaulted = false;
  try {
    input = await req.json();
  } catch {
    input = { probe: "pennyrail" };
    inputDefaulted = true;
  }

  const value = input && typeof input === "object" && "value" in input ? input.value : input;
  const canonical = JSON.stringify(sort(value));
  return NextResponse.json({
    canonical,
    bytes: new TextEncoder().encode(canonical).length,
    inputDefaulted,
  });
};

export const POST = withX402(
  handler,
  penny("Canonicalize JSON by recursively sorting object keys."),
  x402Server,
);
