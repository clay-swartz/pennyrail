import { NextRequest, NextResponse } from "next/server";
import { runRevenueProduct, type RevenueTier } from "@/lib/revenue-engine";

export function createRevenueHandler(tier: RevenueTier) {
  return async (req: NextRequest): Promise<NextResponse<any>> => {
    try {
      const prefix = `/api/p/${tier}/`;
      const pathname = req.nextUrl.pathname;
      const slug = decodeURIComponent(pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "").trim();
      if (!slug) return NextResponse.json({ error: "product slug required" }, { status: 404 });
      const body = await req.json();
      const result = await runRevenueProduct(slug, tier, body?.input ?? body);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "revenue product failed" }, { status: 400 });
    }
  };
}
