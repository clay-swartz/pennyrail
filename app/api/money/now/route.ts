import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { portfolioStatus } from "@/lib/portfolio-engine";
import { permitRailStripeRevenue24h } from "@/lib/permitrail-stripe-revenue";
import { scanExternalRevenue24h } from "@/lib/revenue-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function n(value: unknown) { const x = Number(value); return Number.isFinite(x) ? x : 0; }
function round(value: number) { return Number(value.toFixed(6)); }

export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const [portfolioR, stripeR, chainR] = await Promise.allSettled([
    portfolioStatus(),
    permitRailStripeRevenue24h(),
    scanExternalRevenue24h(),
  ]);

  const portfolio: any = portfolioR.status === "fulfilled" ? portfolioR.value?.state : null;
  const stripe: any = stripeR.status === "fulfilled" ? stripeR.value : null;
  const chain: any = chainR.status === "fulfilled" ? chainR.value : null;
  const stored = portfolio?.money || {};
  const molt = n(portfolio?.moltJobs?.settledRevenueUsd);
  const x402 = n(chain?.external?.usdcUsd);
  const stripeGross = n(stripe?.grossUsd);
  const nonStripeRecordedCost24h = Math.max(0, n(stored.actualKnownCost24hUsd) - n(stored.stripeKnownFees24hUsd));
  const knownFees = n(stripe?.knownFeesUsd);
  const gross24h = round(x402 + stripeGross + n(stored.moltJobsOutside24hUsd));
  const cost24h = round(nonStripeRecordedCost24h + knownFees);
  const net24h = round(gross24h - cost24h);

  const stripePayments = Array.isArray(stripe?.payments) ? stripe.payments.map((p: any) => ({
    source: "PermitRail Stripe",
    amountUsd: n(p.grossUsd),
    feeUsd: p.feeUsd == null ? null : n(p.feeUsd),
    netUsd: p.netUsd == null ? null : n(p.netUsd),
    at: p.at || null,
    id: p.key || null,
  })) : [];
  const x402Payments = Array.isArray(chain?.external?.transfers) ? chain.external.transfers.map((p: any) => ({
    source: "Base USDC / x402",
    amountUsd: n(p.amountUsd),
    feeUsd: null,
    netUsd: n(p.amountUsd),
    at: null,
    id: p.txHash || null,
  })) : [];

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    live24h: {
      grossUsd: gross24h,
      knownCostUsd: cost24h,
      netUsd: net24h,
      payerCount: n(chain?.external?.uniquePayers) + n(stripe?.payments?.length ? new Set(stripe.payments.map((p:any) => p.subscriptionId)).size : 0) + (molt > 0 ? 1 : 0),
      paymentCount: n(chain?.external?.transferCount) + stripePayments.length + (molt > 0 ? 1 : 0),
    },
    rails: {
      stripe: { configured: Boolean(stripe?.configured), grossUsd: stripeGross, knownFeesUsd: knownFees, knownNetUsd: n(stripe?.knownNetUsd), payments: stripePayments, error: stripe?.error || null },
      x402: { ready: Boolean(chain?.revenueReady), grossUsd: x402, payerCount: n(chain?.external?.uniquePayers), paymentCount: n(chain?.external?.transferCount), payments: x402Payments, error: chainR.status === "rejected" ? String(chainR.reason) : null },
      moltJobs: { grossUsd: n(stored.moltJobsOutside24hUsd) },
      rapidApi: { automatedRevenueImport: false, note: "RapidAPI provider revenue is visible in RapidAPI Studio → Analytics → Revenue Analytics and Monetize → Transactions; rapidapi.com does not expose that provider revenue feed through the public Platform API used by ordinary marketplace providers." },
    },
    durable: {
      allTimeOutsideUsd: n(stored.allTimeOutsideUsd),
      allTimeKnownCostUsd: n(stored.allTimeKnownCostUsd),
      allTimeNetUsd: n(stored.allTimeNetUsd),
      firstDollarAt: stored.firstDollarAt || null,
      firstDollarSource: stored.firstDollarSource || null,
      lastPortfolioTickAt: portfolio?.lastTickAt || null,
    },
    caveat: "Live 24h Stripe and Base USDC are queried directly on every refresh. Durable all-time totals remain the Portfolio Engine checkpoint and may trail a new payment until its next reconciliation tick. RapidAPI marketplace earnings remain visible in RapidAPI until a provider-accessible revenue API is available.",
  }, { headers: { "cache-control": "no-store" } });
}
