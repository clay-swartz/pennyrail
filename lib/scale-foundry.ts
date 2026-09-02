import type { PolymarketUSScan } from "@/lib/polymarket-us";

const RADAR = "https://api.402radar.io";

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

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchJson(url: string) {
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "PennyRail-Money-Foundry/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const raw = await r.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!r.ok) throw new Error(`Foundry ${new URL(url).hostname} HTTP ${r.status}: ${raw.slice(0, 240)}`);
  return body;
}

function creditsToUsd(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n / 1_000_000 : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function runMoneyFoundry(polymarket: PolymarketUSScan): Promise<MoneyFoundryScan> {
  let radarError: string | null = null;
  let services: any[] = [];
  try {
    const radar = await fetchJson(`${RADAR}/v1/radar/services?window=24h&limit=100&sort=score`);
    services = Array.isArray(radar?.services) ? radar.services : [];
  } catch (error) {
    radarError = error instanceof Error ? error.message : String(error);
  }

  const normalized = services.map((row: any) => ({
    id: String(row?.id || ""),
    name: String(row?.name || row?.id || "unknown"),
    category: String(row?.categoryId || row?.category || "other"),
    samples: Math.max(0, num(row?.sampleCount ?? row?.samples ?? row?.payments24h)),
    medianPriceUsd: creditsToUsd(row?.medianPriceCredits ?? row?.priceCredits),
    score: Number.isFinite(Number(row?.score)) ? Number(row.score) : null,
  })).filter((row: any) => row.id);
  const prices = normalized.map((row: any) => row.medianPriceUsd).filter((v: any): v is number => typeof v === "number");
  const x402Samples = normalized.reduce((sum: number, row: any) => sum + row.samples, 0);
  const at025 = normalized.filter((row: any) => (row.medianPriceUsd ?? 0) >= 0.25).length;
  const at1 = normalized.filter((row: any) => (row.medianPriceUsd ?? 0) >= 1).length;
  const directPoolCapacity = Math.max(0, num(polymarket?.largestDailyizedPoolUsd));
  const directPoolMarkets = Math.max(0, num(polymarket?.marketsWithAtLeast1000DailyPool));

  const lanes: FoundryLane[] = [
    {
      id: "batchrail-bulk-inference",
      name: "BatchRail bulk machine inference",
      kind: "transaction-toll",
      measuredDemand: "Paid machine-inference gateways charge per request; BatchRail compresses up to 1,000 short classifications into one x402 settlement and one bounded upstream inference call.",
      plausibleDailyNetCeilingUsd: null,
      setupRequiredNow: false,
      status: "scale-now",
      reason: "Live buyer-triggered fulfillment has positive guarded contribution and no speculative upstream spend. It can earn immediately; outside demand/throughput is the only unproven variable.",
    },
    {
      id: "polymarket-us-incentives",
      name: "Polymarket US incentive harvesting",
      kind: "external-pool",
      measuredDemand: `${directPoolMarkets} active reward periods with >=$1,000/day conservative pool capacity; largest screened pool/day ${directPoolCapacity.toFixed(0)} USD`,
      plausibleDailyNetCeilingUsd: directPoolCapacity >= 1_000 ? directPoolCapacity : null,
      setupRequiredNow: false,
      status: directPoolCapacity >= 1_000 ? "paper" : "background",
      reason: directPoolCapacity >= 1_000
        ? "External money is already budgeted by the exchange. PennyRail is measuring competition, capital efficiency and markout before credentials/capital are requested."
        : "Current public pool capacity does not clear the $1K/day scale gate.",
    },
    {
      id: "outcome-execution-tollbooth",
      name: "Outcome execution / guaranteed-result tollbooth",
      kind: "transaction-toll",
      measuredDemand: radarError
        ? "External 402 market radar is temporarily unavailable; the lane remains build-only rather than being inferred from missing data."
        : `${x402Samples.toLocaleString()} 24h reliability/payment samples across ${normalized.length} machine-paid services; ${at025} observed services price at >=$0.25`,
      plausibleDailyNetCeilingUsd: null,
      setupRequiredNow: false,
      status: !radarError && x402Samples >= 1_000 && at025 > 0 ? "build" : "background",
      reason: "Build higher-value outcomes and take a spread only when measured demand supports the ceiling; do not add another undifferentiated catalog of tiny utilities.",
    },
    {
      id: "b2b-demand-foundry",
      name: "High-ticket Demand Foundry",
      kind: "high-ticket-product",
      measuredDemand: "Public-web problem discovery; manufacture a product only after a measurable expensive failure is found in a reachable buyer segment.",
      plausibleDailyNetCeilingUsd: null,
      setupRequiredNow: false,
      status: "build",
      reason: "Non-agentic escape hatch: a small number of high-margin recurring sales can reach $1K/day without million-call traffic. It runs in parallel with machine-commerce lanes.",
    },
  ];

  return {
    ok: !radarError,
    generatedAt: new Date().toISOString(),
    x402: {
      servicesObserved: normalized.length,
      samples24h: x402Samples,
      pricedServices: prices.length,
      servicesAtOrAbove025: at025,
      servicesAtOrAbove1: at1,
      medianObservedPriceUsd: median(prices),
      topBySamples: normalized.sort((a: any, b: any) => b.samples - a.samples).slice(0, 5),
    },
    lanes,
    primary: "batchrail-bulk-inference",
    note: "Scale gate: no user setup for lanes whose measured or structurally credible ceiling is below $1,000/day NET. Low-dollar bounty rails remain background-only.",
    error: radarError,
  };
}
