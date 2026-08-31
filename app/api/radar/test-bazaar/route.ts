import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";
import { BAZAAR_GAP_PRODUCTS, type BazaarGapProduct } from "@/lib/x402-bazaar";

export const dynamic = "force-dynamic";

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

// One bounded indexing bootstrap only. Keep total <= the operator button's
// existing "$0.02 max" promise. These settlements are distribution seeds,
// NEVER organic revenue.
const SEED_IDS = new Set([
  "web.extract",              // $0.005
  "x402.quote",               // $0.002
  "data.hacker-news",         // $0.005
  "openapi.validate-payload", // $0.001
  "json.query",               // $0.001
  "color.convert",            // $0.001
  "forecast.naive",           // $0.001
]);

export async function POST(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const selected: BazaarGapProduct[] = BAZAAR_GAP_PRODUCTS.filter((product: BazaarGapProduct) => SEED_IDS.has(product.id));
  const plannedSpendUsd = Number(selected.reduce((sum: number, p: BazaarGapProduct) => sum + p.priceUsd, 0).toFixed(6));
  if (plannedSpendUsd > 0.02) {
    return NextResponse.json({
      error: "Bazaar seed plan exceeds hard $0.02 total budget.",
      plannedSpendUsd,
    }, { status: 500 });
  }

  const paidFetch = await paidFetchBaseUsdcCapped(0.02);
  const origin = publicOrigin(req);
  const results: any[] = [];

  for (const product of selected) {
    const url = `${origin}${product.bazaarPath}`;
    try {
      const response = await paidFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(product.sampleInput),
        cache: "no-store",
      });
      const text = await response.text();
      let body: any = null;
      try { body = text ? JSON.parse(text) : null; } catch {}
      results.push({
        ok: response.ok,
        productId: product.id,
        priceUsd: product.priceUsd,
        url,
        status: response.status,
        paymentResponsePresent: Boolean(
          response.headers.get("payment-response") ||
          response.headers.get("x-payment-response")
        ),
        result: body ?? text.slice(0, 500),
      });
    } catch (error) {
      results.push({
        ok: false,
        productId: product.id,
        priceUsd: product.priceUsd,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const succeeded = results.filter(row => row.ok).length;
  return NextResponse.json({
    ok: succeeded === selected.length,
    stage: succeeded === selected.length ? "bazaar-catalog-bootstrap-complete" : "bazaar-catalog-bootstrap-partial",
    plannedSpendUsd,
    attempted: selected.length,
    succeeded,
    failed: selected.length - succeeded,
    results,
    note: "These are bounded internal indexing settlements, not organic customer revenue. Dynamic PennyRail wildcard routes remain excluded from Bazaar discovery.",
  }, { status: succeeded ? 200 : 502 });
}
