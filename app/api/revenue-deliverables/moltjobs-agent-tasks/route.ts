import { NextResponse } from "next/server";
import { agentTaskDeliverable } from "@/lib/revenue-strike-data";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(agentTaskDeliverable(), {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "access-control-allow-origin": "*",
    },
  });
}
