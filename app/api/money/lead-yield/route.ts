import { NextResponse } from "next/server";
import { scanLeadYield } from "@/lib/lead-yield";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await scanLeadYield();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 502,
    headers: {
      "cache-control": "no-store",
    },
  });
}
