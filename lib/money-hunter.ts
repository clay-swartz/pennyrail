import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { activateThe402Provider, the402Earnings } from "@/lib/the402";
import { sweepThe402RequestsWithGapFallback } from "@/lib/gap-bidder";
import { scanAgenteryPain } from "@/lib/agentery-pain";
import { scanLeadYield } from "@/lib/lead-yield";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";
import { resolveRevenueNeed } from "@/lib/revenue-engine";

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

async function parseJson(response: Response) {
  const raw = await response.text();
  try { return raw ? JSON.parse(raw) : null; }
  catch { return raw || null; }
}

async function registerAgent402() {
  try {
    const response = await fetch("https://agent402.tools/api/index/register", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ origin: origin() }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    return {
      ok: response.ok,
      status: response.status,
      response: await parseJson(response),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function collectStrings(value: any, out: string[], keyHint = "") {
  if (out.length >= 100 || value == null) return;
  if (typeof value === "string") {
    const key = keyHint.toLowerCase();
    const useful = /(query|request|need|demand|gap|title|task|phrase|description|text|service|tool)/.test(key);
    const clean = value.replace(/\s+/g, " ").trim();
    if (useful && clean.length >= 5 && clean.length <= 400) out.push(clean);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, keyHint);
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectStrings(item, out, key);
  }
}

function demandMatches(...bodies: any[]) {
  const phrases: string[] = [];
  for (const body of bodies) collectStrings(body, phrases);
  const seen = new Set<string>();
  const unique = phrases.filter(phrase => {
    const key = phrase.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 60).map(phrase => {
    const resolved = resolveRevenueNeed(phrase);
    return {
      phrase,
      productId: resolved?.product?.id ?? null,
      matchScore: resolved?.score ?? 0,
      canSellNow: Boolean(resolved && resolved.score >= 5),
    };
  });
}

async function buyAgent402Intel() {
  const result: any = {
    ok: false,
    maxSpendUsd: 0.012,
    demand: null,
    bestsellers: null,
    error: null,
  };

  try {
    // Each purchase is individually capped at $0.006 in Base USDC.
    // If Agent402 raises either price above the cap, PennyRail refuses to pay.
    const paidFetch = await paidFetchBaseUsdcCapped(0.006);
    const [demandResponse, bestsellerResponse] = await Promise.all([
      paidFetch("https://agent402.tools/api/demand-radar?sort=count&limit=50&minCount=1", {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
      paidFetch("https://agent402.tools/api/bestsellers?days=30&sort=buyers&limit=50", {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
    ]);

    result.demand = await parseJson(demandResponse);
    result.bestsellers = await parseJson(bestsellerResponse);
    result.ok = demandResponse.ok && bestsellerResponse.ok;
    if (!result.ok) {
      result.error = `Agent402 intel HTTP ${demandResponse.status}/${bestsellerResponse.status}`;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  result.matches = demandMatches(result.demand, result.bestsellers);
  result.sellableNow = result.matches.filter((row: any) => row.canSellNow).slice(0, 25);
  result.unmatched = result.matches.filter((row: any) => !row.canSellNow).slice(0, 25);
  return result;
}

async function runThe402() {
  const participantId = process.env.THE402_PARTICIPANT_ID?.trim() || "";
  const apiKey = process.env.THE402_API_KEY?.trim() || "";
  const webhookSecret = process.env.THE402_WEBHOOK_SECRET?.trim() || "";

  if (!participantId || !apiKey || !webhookSecret) {
    return {
      configured: false,
      acted: false,
      reason: "the402 credentials are not configured",
    };
  }

  try {
    const activation = await activateThe402Provider({
      participantId,
      apiKey,
      webhookUrl: `${origin()}/api/the402/webhook`,
    });

    // This is an ACTION, not just a scan:
    // live postings are evaluated and PennyRail places bounded bids automatically.
    const sweep = await sweepThe402RequestsWithGapFallback(apiKey, 50);

    let earnings: any = null;
    try { earnings = await the402Earnings(apiKey); } catch {}

    return {
      configured: true,
      acted: true,
      servicesLive: Array.isArray(activation.services) ? activation.services.length : null,
      servicesCreatedThisRun: activation.createdCount ?? 0,
      postingsChecked: sweep.checked,
      bidsPlaced: sweep.bidsPlaced,
      existingCapabilityBids: sweep.existingCapabilityBids,
      gapBids: sweep.gapBids,
      unresolvedObserved: sweep.unresolvedObserved,
      earnings,
      bidResults: sweep.results,
    };
  } catch (error) {
    return {
      configured: true,
      acted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runMoneyHunter() {
  const startedAt = Date.now();

  // Refresh the internal revenue engine first so any live demand-derived aliases
  // exist before PennyRail republishes itself to external discovery.
  const audit = await getCachedRevenueAudit();

  const [agent402Intel, agenteryPain, leadYield, the402] = await Promise.all([
    buyAgent402Intel(),
    scanAgenteryPain(),
    scanLeadYield(),
    runThe402(),
  ]);

  // Re-register AFTER refreshing all live catalog surfaces. Agent402's crawler
  // can then see the newest manifest/OpenAPI state and route buyers to PennyRail.
  const agent402Registration = await registerAgent402();

  const automaticActions = [
    {
      action: "REFRESH_DEMAND_CATALOG",
      executed: true,
      evidence: {
        autoLive: audit.autoLive?.length || 0,
        unresolved: audit.unresolved?.length || 0,
      },
    },
    {
      action: "BUY_AGENT402_DEMAND_AND_BESTSELLER_INTEL",
      executed: agent402Intel.ok,
      maxSpendUsd: agent402Intel.maxSpendUsd,
      sellableSignalsFound: agent402Intel.sellableNow?.length || 0,
      error: agent402Intel.error || null,
    },
    {
      action: "REGISTER_OR_REFRESH_AGENT402_SELLER",
      executed: Boolean(agent402Registration.ok),
      result: agent402Registration,
    },
    {
      action: "ACTIVATE_THE402_AND_AUTO_BID_LIVE_REQUESTS",
      executed: Boolean(the402.acted),
      bidsPlaced: the402.bidsPlaced || 0,
      servicesCreatedThisRun: the402.servicesCreatedThisRun || 0,
      error: the402.error || null,
    },
  ];

  return {
    ok: true,
    mode: "AUTONOMOUS_MONEY_HUNTER_V54",
    targetNetUsdPerDay: 1000,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,

    // Money first: keep actual earnings/payment state near the top.
    money: {
      the402Earnings: the402.earnings ?? null,
      targetNetUsdPerDay: 1000,
    },

    automaticActions,

    // Observations feed the next autonomous action cycle. They are not treated
    // as success unless money actually lands.
    signals: {
      agent402: {
        sellableNow: agent402Intel.sellableNow,
        unmatched: agent402Intel.unmatched,
      },
      agenteryPain: {
        ok: agenteryPain?.ok ?? false,
        unresolvedGaps: agenteryPain?.unresolvedGaps ?? [],
        existingCapabilityMatches: agenteryPain?.existingCapabilityMatches ?? [],
      },
      leadYield: {
        ok: leadYield?.ok ?? false,
        economics: leadYield?.economics ?? null,
        actionQueue: leadYield?.actionQueue ?? [],
      },
    },

    portfolio: audit.portfolio,
    opportunityCounts: {
      autoLive: audit.autoLive?.length || 0,
      unresolved: audit.unresolved?.length || 0,
      agenteryUnresolved: agenteryPain?.unresolvedGaps?.length || 0,
      leadYieldObserved: leadYield?.economics?.payoutRowsObserved || 0,
      agent402SellableSignals: agent402Intel.sellableNow?.length || 0,
      the402BidsPlaced: the402.bidsPlaced || 0,
    },

    raw: {
      the402,
      agent402Registration,
      agent402Intel: {
        ok: agent402Intel.ok,
        maxSpendUsd: agent402Intel.maxSpendUsd,
        error: agent402Intel.error,
      },
    },
  };
}
