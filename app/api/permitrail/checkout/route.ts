import { NextRequest, NextResponse } from "next/server";
import { createPermitRailCheckout, PERMITRAIL_PLANS, type PermitRailPlanId } from "@/lib/permitrail-stripe";
import { PERMITRAIL_CITIES, PERMITRAIL_TRADES, type PermitRailCity, type PermitRailTrade } from "@/lib/permitrail-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function origin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const planRaw = String(form.get("plan") || "starter") as PermitRailPlanId;
    const cityRaw = String(form.get("city") || "all");
    const tradeRaw = String(form.get("trade") || "all");
    const plan = planRaw in PERMITRAIL_PLANS ? planRaw : "starter";
    const planDef = PERMITRAIL_PLANS[plan];
    const city = cityRaw === "all" || PERMITRAIL_CITIES.includes(cityRaw as PermitRailCity) ? cityRaw as PermitRailCity | "all" : "all";
    const trade = tradeRaw === "all" || PERMITRAIL_TRADES.includes(tradeRaw as PermitRailTrade) ? tradeRaw as PermitRailTrade | "all" : "all";
    if (planDef.cityScope === "single" && city === "all") throw new Error("Starter requires one market");
    if (planDef.tradeScope === "single" && trade === "all") throw new Error(`${planDef.name} requires one primary trade`);
    const checkout = await createPermitRailCheckout({ plan, city, trade, origin: origin(req) });
    if (!checkout.url) throw new Error("Stripe did not return a checkout URL");
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.redirect(`${origin(req)}/permitrail?checkout_error=${encodeURIComponent(message.slice(0, 180))}`, 303);
  }
}
