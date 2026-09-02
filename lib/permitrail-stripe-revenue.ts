function secretKey() { return process.env.STRIPE_SECRET_KEY?.trim() || ""; }

async function stripe(path: string) {
  if (!secretKey()) throw new Error("Stripe is not configured");
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { authorization: `Bearer ${secretKey()}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await r.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!r.ok) throw new Error(`Stripe ${path} HTTP ${r.status}: ${body?.error?.message || raw.slice(0, 220)}`);
  return body;
}

function usd(cents: unknown) {
  const n = Number(cents);
  return Number.isFinite(n) ? n / 100 : 0;
}

function invoiceSubscriptionId(invoice: any) {
  if (typeof invoice?.subscription === "string") return invoice.subscription;
  if (invoice?.subscription?.id) return String(invoice.subscription.id);
  const nested = invoice?.parent?.subscription_details?.subscription;
  if (typeof nested === "string") return nested;
  if (nested?.id) return String(nested.id);
  return null;
}

function invoiceChargeId(invoice: any) {
  if (typeof invoice?.charge === "string") return invoice.charge;
  if (invoice?.charge?.id) return String(invoice.charge.id);
  const payments = Array.isArray(invoice?.payments?.data) ? invoice.payments.data : [];
  for (const row of payments) {
    const charge = row?.payment?.charge || row?.charge;
    if (typeof charge === "string") return charge;
    if (charge?.id) return String(charge.id);
  }
  return null;
}

export type PermitRailStripeRevenue = {
  configured: boolean;
  checkedAt: string;
  grossUsd: number;
  knownFeesUsd: number;
  knownNetUsd: number;
  costComplete: boolean;
  payments: Array<{ key: string; at: string; grossUsd: number; feeUsd: number | null; netUsd: number | null; subscriptionId: string }>;
  error: string | null;
};

export async function permitRailStripeRevenue24h(): Promise<PermitRailStripeRevenue> {
  if (!secretKey()) return { configured: false, checkedAt: new Date().toISOString(), grossUsd: 0, knownFeesUsd: 0, knownNetUsd: 0, costComplete: true, payments: [], error: null };
  try {
    const since = Math.floor((Date.now() - 86_400_000) / 1000);
    const list = await stripe(`/invoices?status=paid&created[gte]=${since}&limit=100`);
    const invoices = Array.isArray(list?.data) ? list.data : [];
    const subscriptionCache = new Map<string, any>();
    const payments: PermitRailStripeRevenue["payments"] = [];

    for (const invoice of invoices) {
      const subId = invoiceSubscriptionId(invoice);
      if (!subId) continue;
      let sub = subscriptionCache.get(subId);
      if (!sub) {
        try { sub = await stripe(`/subscriptions/${encodeURIComponent(subId)}`); }
        catch { sub = null; }
        subscriptionCache.set(subId, sub);
      }
      if (String(sub?.metadata?.product || "") !== "permitrail") continue;
      const grossUsd = usd(invoice?.amount_paid);
      if (!(grossUsd > 0)) continue;
      const chargeId = invoiceChargeId(invoice);
      let feeUsd: number | null = null;
      let netUsd: number | null = null;
      if (chargeId) {
        try {
          const charge = await stripe(`/charges/${encodeURIComponent(chargeId)}?expand[]=balance_transaction`);
          const bt = charge?.balance_transaction;
          if (bt && typeof bt === "object") {
            feeUsd = usd(bt?.fee);
            netUsd = usd(bt?.net);
          }
        } catch {}
      }
      payments.push({
        key: String(invoice?.id || chargeId || `${subId}:${invoice?.created || ""}`),
        at: new Date(Number(invoice?.created || since) * 1000).toISOString(),
        grossUsd,
        feeUsd,
        netUsd,
        subscriptionId: subId,
      });
    }

    const grossUsd = payments.reduce((sum, p) => sum + p.grossUsd, 0);
    const knownFeesUsd = payments.reduce((sum, p) => sum + (p.feeUsd ?? 0), 0);
    const knownNetUsd = payments.reduce((sum, p) => sum + (p.netUsd ?? (p.grossUsd - (p.feeUsd ?? 0))), 0);
    return {
      configured: true,
      checkedAt: new Date().toISOString(),
      grossUsd: Number(grossUsd.toFixed(2)),
      knownFeesUsd: Number(knownFeesUsd.toFixed(2)),
      knownNetUsd: Number(knownNetUsd.toFixed(2)),
      costComplete: payments.every(p => p.feeUsd != null && p.netUsd != null),
      payments,
      error: null,
    };
  } catch (error) {
    return { configured: true, checkedAt: new Date().toISOString(), grossUsd: 0, knownFeesUsd: 0, knownNetUsd: 0, costComplete: false, payments: [], error: error instanceof Error ? error.message : String(error) };
  }
}
