import type { PolymarketUSScan } from "@/lib/polymarket-us";

export type FoundryLane = {
  id: string;
  name: string;
  kind: "external-pool" | "transaction-toll" | "high-ticket-product";
  measuredDemand: string;
  plausibleDailyNetCeilingUsd: number | null;
  setupRequiredNow: boolean;
  status: "scale-now" | "paper" | "build" | "background" | "reject";
  reason: string;
};

export type MoneyFoundryScan = {
  ok: boolean;
  generatedAt: string;
  x402: {
    servicesObserved: number;
    samples24h: number;
    pricedServices: number;
    servicesAtOrAbove025: number;
    servicesAtOrAbove1: number;
    medianObservedPriceUsd: number | null;
    topBySamples: Array<{ id: string; name: string; category: string; samples: number; medianPriceUsd: number | null; score: number | null }>;
  };
  lanes: FoundryLane[];
  primary: string;
  note: string;
  error: string | null;
};

export async function runMoneyFoundry(polymarket: PolymarketUSScan): Promise<MoneyFoundryScan> {
  const best = polymarket.top[0] || null;
  const correctedPrograms = Math.max(0, polymarket.programsWithAtLeast1000DailyPool || 0);
  const bestPool = Math.max(0, polymarket.largestDailyizedPoolUsd || 0);
  const capital = best?.estimatedCapitalFor1000GrossUsd ?? null;

  const lanes: FoundryLane[] = [
    {
      id: "batchrail-bulk-inference",
      name: "BatchRail bulk machine inference",
      kind: "transaction-toll",
      measuredDemand: "Live x402 machine-inference product. The remaining unknown is outside buyer throughput, measured by settled external payments rather than a third-party radar.",
      plausibleDailyNetCeilingUsd: null,
      setupRequiredNow: false,
      status: "scale-now",
      reason: "Buyer-triggered fulfillment has positive guarded contribution and no speculative upstream spend. Keep it live while distribution proves or disproves throughput.",
    },
    {
      id: "polymarket-us-incentives",
      name: "Polymarket US incentive harvesting",
      kind: "external-pool",
      measuredDemand: `${correctedPrograms} unique shared program/time-period pools currently have >=$1,000/day capacity; largest corrected pool/day $${bestPool.toFixed(0)}${capital == null ? "" : `; sampled capital screen for $1K gross/day ~$${capital.toFixed(0)}`}`,
      plausibleDailyNetCeilingUsd: bestPool >= 1_000 ? bestPool : null,
      setupRequiredNow: false,
      status: bestPool >= 1_000 ? "paper" : "background",
      reason: "The pool is external money already budgeted by the exchange. v68 counts each shared program once and measures book competition/capital before any credentials or capital are requested.",
    },
    {
      id: "outcome-execution-tollbooth",
      name: "Outcome execution / guaranteed-result tollbooth",
      kind: "transaction-toll",
      measuredDemand: "Build from PennyRail's own settled buyer traffic and direct marketplace evidence. The suspended 402radar service is no longer a dependency or a demand proxy.",
      plausibleDailyNetCeilingUsd: null,
      setupRequiredNow: false,
      status: "build",
      reason: "Create higher-value composite outcomes only when direct buyer/payment evidence identifies a gap; do not proliferate undifferentiated penny utilities.",
    },
    {
      id: "b2b-demand-foundry",
      name: "High-ticket Demand Foundry",
      kind: "high-ticket-product",
      measuredDemand: "Public-web problem discovery across any industry; manufacture a turnkey product only after finding a measurable expensive failure in a reachable buyer segment.",
      plausibleDailyNetCeilingUsd: null,
      setupRequiredNow: false,
      status: "build",
      reason: "Parallel non-agentic escape hatch: a few high-margin recurring sales can reach $1K/day without requiring million-call machine traffic.",
    },
  ];

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    x402: {
      servicesObserved: 0,
      samples24h: 0,
      pricedServices: 0,
      servicesAtOrAbove025: 0,
      servicesAtOrAbove1: 0,
      medianObservedPriceUsd: null,
      topBySamples: [],
    },
    lanes,
    primary: best?.estimatedCapitalFor1000GrossUsd != null && best.estimatedCapitalFor1000GrossUsd <= 10_000
      ? "polymarket-us-incentives"
      : "batchrail-bulk-inference",
    note: "v68 Scale Gate uses direct settlement data and official external-pool data. Dead third-party demand feeds no longer block the Foundry.",
    error: null,
  };
}
