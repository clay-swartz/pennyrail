import { NextRequest, NextResponse } from "next/server";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";

export const dynamic = "force-dynamic";

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  const audit = await getCachedRevenueAudit();
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const needle = norm(q);
  let products = Array.isArray(audit.productRoutes) ? audit.productRoutes : [];
  if (needle) {
    products = products
      .map((p: any) => {
        const hay = norm(`${p.alias} ${p.title} ${p.description} ${p.id}`);
        const words = needle.split(" ").filter(Boolean);
        const hits = words.filter((w: string) => hay.includes(w)).length;
        const score = hay.includes(needle) ? 100 : hits;
        return { p, score };
      })
      .filter((x: any) => x.score > 0)
      .sort((a: any, b: any) => b.score - a.score || (b.p.demand?.score || 0) - (a.p.demand?.score || 0))
      .map((x: any) => x.p)
      .slice(0, 25);
  }

  return NextResponse.json({
    service: "PennyRail Revenue Catalog",
    generatedAt: audit.generatedAt,
    query: q || null,
    totalProducts: Array.isArray(audit.productRoutes) ? audit.productRoutes.length : 0,
    returned: products.length,
    products: products.map((p: any) => ({
      id: p.id,
      alias: p.alias,
      title: p.title,
      description: p.description,
      path: p.path,
      priceUsd: p.priceUsd,
      tier: p.tier,
      inputHint: p.inputHint,
      sampleInput: p.sampleInput,
      source: p.source,
      demand: p.demand || null,
    })),
  }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
}
