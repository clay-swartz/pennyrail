import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import {
  activateThe402Provider,
  the402Earnings,
} from "@/lib/the402";
import {
  getThe402RuntimeCredentials,
  the402WebhookUrl,
} from "@/lib/the402-runtime";
import { sweepThe402RequestsWithGapFallback } from "@/lib/gap-bidder";
import { scanAgenteryPain } from "@/lib/agentery-pain";
import { scanLeadYield } from "@/lib/lead-yield";
import { resolveRevenueNeed } from "@/lib/revenue-engine";

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${production
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")}`;
  }

  return "https://pennyrail.vercel.app";
}

async function parseJson(response: Response) {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return raw || null;
  }
}

async function registerAgent402() {
  try {
    const response = await fetch(
      "https://agent402.tools/api/index/register",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ origin: origin() }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );

    return {
      ok: response.ok,
      status: response.status,
      response: await parseJson(response),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function registerX402DashUrlContents() {
  const endpoint = `${origin()}/api/agent/url-contents`;

  try {
    const response = await fetch(
      "https://api.x402dash.com/v1/register",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          url: endpoint,
          name: "PennyRail URL Contents",
          description:
            "Retrieve clean text and optional highlights from public URLs for agent research, RAG and page-reading workflows.",
          category: "Search/Research",
          tags: [
            "url contents",
            "page text",
            "web extraction",
            "research",
            "rag",
            "agent",
          ],
          contact: origin(),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );

    const body = await parseJson(response);

    return {
      ok: response.ok || response.status === 409,
      status: response.status,
      endpoint,
      response: body,
    };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function collectStrings(value: any, out: string[], keyHint = "") {
  if (out.length >= 150 || value == null) return;

  if (typeof value === "string") {
    const key = keyHint.toLowerCase();
    const useful =
      /(query|request|need|demand|gap|title|task|phrase|description|text|service|tool)/.test(
        key,
      );

    const clean = value.replace(/\s+/g, " ").trim();
    if (useful && clean.length >= 5 && clean.length <= 400) {
      out.push(clean);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, keyHint);
    return;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, out, key);
    }
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

  return unique.slice(0, 100).map(phrase => {
    const resolved = resolveRevenueNeed(phrase);
    return {
      phrase,
      productId: resolved?.product?.id ?? null,
      matchScore: resolved?.score ?? 0,
      canSellNow: Boolean(resolved && resolved.score >= 5),
    };
  });
}

async function readAgent402FreeSignals() {
  const result: any = {
    ok: false,
    wishes: null,
    sales: null,
    error: null,
  };

  try {
    const [wishesResponse, salesResponse] = await Promise.all([
      fetch("https://agent402.tools/api/wishes", {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
      fetch("https://agent402.tools/api/sales", {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }),
    ]);

    result.wishes = await parseJson(wishesResponse);
    result.sales = await parseJson(salesResponse);
    result.ok = wishesResponse.ok && salesResponse.ok;

    if (!result.ok) {
      result.error =
        `Agent402 free signals HTTP wishes=${wishesResponse.status} sales=${salesResponse.status}`;
    }
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : String(error);
  }

  result.matches = demandMatches(result.wishes);
  result.sellableNow = result.matches
    .filter((row: any) => row.canSellNow)
    .slice(0, 40);
  result.unmatched = result.matches
    .filter((row: any) => !row.canSellNow)
    .slice(0, 40);

  return result;
}

async function the402Health() {
  try {
    const response = await fetch("https://api.the402.ai/health", {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const body = await parseJson(response);
    return {
      ok: response.ok,
      paused: Boolean(body?.paused || body?.status === "paused"),
      body,
    };
  } catch (error) {
    return {
      ok: false,
      paused: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runThe402() {
  const health = await the402Health();

  if (health.paused) {
    return {
      configured: false,
      acted: false,
      platformPaused: true,
      reason:
        health.body?.pause_reason ||
        health.body?.reason ||
        "platform paused",
    };
  }

  try {
    const credentials = await getThe402RuntimeCredentials(origin());

    const activation = await activateThe402Provider({
      participantId: credentials.participant_id,
      apiKey: credentials.api_key,
      webhookUrl: the402WebhookUrl(origin()),
    });

    const sweep = await sweepThe402RequestsWithGapFallback(
      credentials.api_key,
      50,
    );

    let earnings: any = null;
    try {
      earnings = await the402Earnings(credentials.api_key);
    } catch {}

    return {
      configured: true,
      credentialMode:
        process.env.THE402_API_KEY?.trim()
          ? "ENV"
          : "AUTONOMOUS_X402_REGISTRATION",
      acted: true,
      participantId: credentials.participant_id,
      servicesLive: Array.isArray(activation.services)
        ? activation.services.length
        : null,
      servicesCreatedThisRun:
        activation.createdCount ?? 0,
      postingsChecked: sweep.checked,
      bidsPlaced: sweep.bidsPlaced,
      existingCapabilityBids:
        sweep.existingCapabilityBids,
      gapBids: sweep.gapBids,
      unresolvedObserved: sweep.unresolvedObserved,
      earnings,
      bidResults: sweep.results,
    };
  } catch (error) {
    return {
      configured: false,
      acted: false,
      error:
        error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runMoneyHunter() {
  const startedAt = Date.now();

  const audit = await getCachedRevenueAudit();

  const [
    agent402Signals,
    agenteryPain,
    leadYield,
    the402,
    x402Dash,
  ] = await Promise.all([
    readAgent402FreeSignals(),
    scanAgenteryPain(),
    scanLeadYield(),
    runThe402(),
    registerX402DashUrlContents(),
  ]);

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
      action: "READ_FREE_AGENT402_DEMAND_SIGNALS",
      executed: agent402Signals.ok,
      sellableSignalsFound:
        agent402Signals.sellableNow?.length || 0,
      unmatchedSignalsFound:
        agent402Signals.unmatched?.length || 0,
      error: agent402Signals.error || null,
    },
    {
      action: "REGISTER_OR_REFRESH_AGENT402_SELLER",
      executed: Boolean(agent402Registration.ok),
      result: agent402Registration,
    },
    {
      action: "REGISTER_PROVEN_URL_CONTENTS_X402DASH",
      executed: Boolean(x402Dash.ok),
      result: x402Dash,
    },
    {
      action: "THE402_AUTO_BID_IF_PLATFORM_LIVE",
      executed: Boolean(the402.acted),
      platformPaused: Boolean(the402.platformPaused),
      credentialMode: the402.credentialMode || null,
      servicesCreatedThisRun:
        the402.servicesCreatedThisRun || 0,
      bidsPlaced: the402.bidsPlaced || 0,
      error: the402.error || null,
    },
  ];

  return {
    ok: true,
    mode: "AUTONOMOUS_MONEY_HUNTER_V58",
    targetNetUsdPerDay: 1000,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,

    money: {
      the402Earnings: the402.earnings ?? null,
      targetNetUsdPerDay: 1000,
    },

    automaticActions,

    signals: {
      agent402: {
        sellableNow: agent402Signals.sellableNow,
        unmatched: agent402Signals.unmatched,
        aggregateSales: agent402Signals.sales,
      },
      agenteryPain: {
        ok: agenteryPain?.ok ?? false,
        unresolvedGaps:
          agenteryPain?.unresolvedGaps ?? [],
        existingCapabilityMatches:
          agenteryPain?.existingCapabilityMatches ?? [],
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
      agenteryUnresolved:
        agenteryPain?.unresolvedGaps?.length || 0,
      leadYieldObserved:
        leadYield?.economics?.payoutRowsObserved || 0,
      agent402SellableSignals:
        agent402Signals.sellableNow?.length || 0,
      agent402UnmatchedSignals:
        agent402Signals.unmatched?.length || 0,
      the402BidsPlaced: the402.bidsPlaced || 0,
      x402DashRegistered: x402Dash.ok ? 1 : 0,
    },

    raw: {
      the402,
      x402Dash,
      agent402Registration,
      agent402Signals: {
        ok: agent402Signals.ok,
        error: agent402Signals.error,
      },
    },
  };
}
