import { NextResponse } from "next/server";
import { loadPermitRailState } from "@/lib/permitrail";
import { PERMITRAIL_PLANS, stripeConfigured, stripeWebhookConfigured } from "@/lib/permitrail-stripe";
import { PERMITRAIL_FEED_PRICE_USD, PERMITRAIL_TERRITORY_PRICE_USD } from "@/lib/permitrail-x402";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const state = await loadPermitRailState();
  return NextResponse.json({
    ok: true,
    product: "PermitRail",
    generatedAt: new Date().toISOString(),
    running: Boolean(state?.scheduler?.ok),
    state,
    monetization: {
      x402: { live: true, feedUsd: PERMITRAIL_FEED_PRICE_USD, territoryUsd: PERMITRAIL_TERRITORY_PRICE_USD },
      stripe: { configured: stripeConfigured(), webhookConfigured: stripeWebhookConfigured(), plans: Object.values(PERMITRAIL_PLANS).map(p => ({ id: p.id, monthlyUsd: p.monthlyUsd })) },
      rapidApi: { configured: Boolean(process.env.RAPIDAPI_PROXY_SECRET?.trim()), route: "/api/permitrail/rapid/feed" },
    },
  }, { headers: { "cache-control": "no-store" } });
}
