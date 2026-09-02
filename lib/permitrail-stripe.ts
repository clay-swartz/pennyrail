import { createHmac, timingSafeEqual } from "node:crypto";
import type { PermitRailCity, PermitRailTrade } from "@/lib/permitrail-core";

export type PermitRailPlanId = "starter" | "growth" | "operator";
export type PermitRailPlan = {
  id: PermitRailPlanId;
  name: string;
  monthlyUsd: number;
  maxSignalsPerRequest: number;
  cityScope: "single" | "all";
  tradeScope: "single" | "all";
  description: string;
};

export const PERMITRAIL_PLANS: Record<PermitRailPlanId, PermitRailPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyUsd: 299,
    maxSignalsPerRequest: 100,
    cityScope: "single",
    tradeScope: "single",
    description: "One market + one trade, with scored public-record project signals and API/CSV access.",
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyUsd: 799,
    maxSignalsPerRequest: 250,
    cityScope: "all",
    tradeScope: "single",
    description: "All supported DFW markets for one trade, with larger API/CSV feeds.",
  },
  operator: {
    id: "operator",
    name: "Operator",
    monthlyUsd: 1499,
    maxSignalsPerRequest: 500,
    cityScope: "all",
    tradeScope: "all",
    description: "Full DFW feed across every supported trade with highest-volume API/CSV access.",
  },
};

function secretKey() { return process.env.STRIPE_SECRET_KEY?.trim() || ""; }
function webhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET?.trim() || ""; }
function accessSecret() {
  return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || secretKey();
}

export function stripeConfigured() { return Boolean(secretKey()); }
export function stripeWebhookConfigured() { return Boolean(webhookSecret()); }

function add(params: URLSearchParams, key: string, value: unknown) {
  if (value == null) return;
  params.append(key, String(value));
}

async function stripe(path: string, init: RequestInit = {}) {
  if (!secretKey()) throw new Error("Stripe is not configured");
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey()}`,
      accept: "application/json",
      ...(init.body ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await r.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!r.ok) throw new Error(`Stripe ${path} HTTP ${r.status}: ${body?.error?.message || raw.slice(0, 240)}`);
  return body;
}

export async function createPermitRailCheckout(args: {
  plan: PermitRailPlanId;
  city?: PermitRailCity | "all";
  trade?: PermitRailTrade | "all";
  origin: string;
}) {
  const plan = PERMITRAIL_PLANS[args.plan];
  if (!plan) throw new Error("Unknown PermitRail plan");
  const params = new URLSearchParams();
  add(params, "mode", "subscription");
  add(params, "success_url", `${args.origin.replace(/\/$/, "")}/permitrail/success?session_id={CHECKOUT_SESSION_ID}`);
  add(params, "cancel_url", `${args.origin.replace(/\/$/, "")}/permitrail?cancelled=1`);
  add(params, "allow_promotion_codes", "true");
  add(params, "billing_address_collection", "auto");
  add(params, "line_items[0][quantity]", "1");
  add(params, "line_items[0][price_data][currency]", "usd");
  add(params, "line_items[0][price_data][unit_amount]", Math.round(plan.monthlyUsd * 100));
  add(params, "line_items[0][price_data][recurring][interval]", "month");
  add(params, "line_items[0][price_data][product_data][name]", `PermitRail ${plan.name}`);
  add(params, "line_items[0][price_data][product_data][description]", plan.description);
  add(params, "metadata[product]", "permitrail");
  add(params, "metadata[plan]", plan.id);
  add(params, "metadata[city]", args.city || "all");
  add(params, "metadata[trade]", args.trade || "all");
  add(params, "subscription_data[metadata][product]", "permitrail");
  add(params, "subscription_data[metadata][plan]", plan.id);
  add(params, "subscription_data[metadata][city]", args.city || "all");
  add(params, "subscription_data[metadata][trade]", args.trade || "all");
  const session = await stripe("/checkout/sessions", { method: "POST", body: params.toString() });
  return { id: String(session?.id || ""), url: String(session?.url || ""), plan };
}

export async function retrieveCheckoutSession(sessionId: string) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new Error("Invalid Stripe Checkout session id");
  return stripe(`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`);
}

function planFromSession(session: any): PermitRailPlan {
  const raw = String(session?.metadata?.plan || session?.subscription?.metadata?.plan || "starter");
  return PERMITRAIL_PLANS[(raw in PERMITRAIL_PLANS ? raw : "starter") as PermitRailPlanId];
}

export function permitRailAccessToken(sessionId: string) {
  const s = accessSecret();
  if (!s) throw new Error("PermitRail access-token secret unavailable");
  return createHmac("sha256", s).update(`permitrail-access-v1:${sessionId}`).digest("hex");
}

function safeEqual(a: string, b: string) {
  try { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); } catch { return false; }
}

export async function verifyPermitRailSubscriber(sessionId: string, token: string) {
  if (!token || !safeEqual(token, permitRailAccessToken(sessionId))) throw new Error("Invalid PermitRail access token");
  const session = await retrieveCheckoutSession(sessionId);
  const subscription = session?.subscription;
  const status = String(subscription?.status || "");
  const active = status === "active" || status === "trialing";
  if (!active) throw new Error(`PermitRail subscription is not active (${status || "unknown"})`);
  const plan = planFromSession(session);
  return {
    active: true,
    plan,
    customer: typeof session?.customer === "string" ? session.customer : session?.customer?.id || null,
    city: String(session?.metadata?.city || subscription?.metadata?.city || "all"),
    trade: String(session?.metadata?.trade || subscription?.metadata?.trade || "all"),
  };
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null) {
  if (!webhookSecret()) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  const parts = String(signatureHeader || "").split(",").map(part => part.trim());
  const timestamp = parts.find(part => part.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter(part => part.startsWith("v1=")).map(part => part.slice(3));
  if (!timestamp || signatures.length === 0) throw new Error("Invalid Stripe-Signature header");
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) throw new Error("Stripe webhook signature timestamp is outside tolerance");
  const expected = createHmac("sha256", webhookSecret()).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!signatures.some(sig => safeEqual(sig, expected))) throw new Error("Stripe webhook signature verification failed");
  return JSON.parse(rawBody || "{}");
}
