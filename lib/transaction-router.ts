import { REVENUE_TIER_PRICE, runRevenueProduct, staticRevenueProductRoutes, type RevenueProductRoute, type RevenueTier } from "@/lib/revenue-engine";

const STOP = new Set(["a","an","and","are","as","at","be","by","can","do","for","from","get","give","i","in","is","it","me","my","of","on","or","please","run","the","this","to","tool","use","want","with"]);

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._~+-]+/g, " ")
    .trim();
}

function tokens(value: unknown) {
  return normalize(value).split(/\s+/).filter(Boolean).filter(t => !STOP.has(t));
}

function unique<T>(values: T[]) { return [...new Set(values)]; }

function routeScore(query: string, route: RevenueProductRoute) {
  const q = normalize(query);
  if (!q) return 0;
  const alias = normalize(route.alias);
  const title = normalize(route.title);
  const id = normalize(route.id);
  const description = normalize(route.description);
  if (q === id || q === alias || q === title) return 100;
  if (alias && q.includes(alias)) return 92;
  if (title && q.includes(title)) return 90;
  if (q.includes(id)) return 88;

  const qTokens = unique(tokens(q));
  if (!qTokens.length) return 0;
  const aliasTokens = new Set(tokens(`${route.alias} ${route.title} ${route.id}`));
  const descTokens = new Set(tokens(description));
  const directHits = qTokens.filter(t => aliasTokens.has(t)).length;
  const descHits = qTokens.filter(t => descTokens.has(t)).length;
  const coverage = directHits / qTokens.length;

  let score = directHits * 14 + descHits * 3 + Math.round(coverage * 32);
  if (coverage === 1 && directHits >= 2) score += 18;
  if (directHits === 1 && qTokens.length === 1) score += 22;
  return Math.min(87, score);
}

export type RouterCandidate = {
  productId: string;
  title: string;
  description: string;
  tier: RevenueTier;
  priceUsd: number;
  score: number;
  alias: string;
  productUrl: string;
  executeUrl: string;
  inputHint: string;
  sampleInput: unknown;
};

function configuredRepresentativeRoutes() {
  const grouped = new Map<string, RevenueProductRoute[]>();
  for (const route of staticRevenueProductRoutes()) {
    const rows = grouped.get(route.id) || [];
    rows.push(route);
    grouped.set(route.id, rows);
  }
  return grouped;
}

export function findRouterCandidates(intent: string, limit = 8): RouterCandidate[] {
  const q = normalize(intent);
  if (!q) return [];
  const grouped = configuredRepresentativeRoutes();
  const candidates: RouterCandidate[] = [];
  for (const [id, routes] of grouped) {
    let best = routes[0];
    let bestScore = 0;
    for (const route of routes) {
      const score = routeScore(q, route);
      if (score > bestScore) { bestScore = score; best = route; }
    }
    if (bestScore <= 0) continue;
    candidates.push({
      productId: id,
      title: best.title,
      description: best.description,
      tier: best.tier,
      priceUsd: REVENUE_TIER_PRICE[best.tier],
      score: bestScore,
      alias: best.alias,
      productUrl: best.path,
      executeUrl: `/api/router/execute/${best.tier}`,
      inputHint: best.inputHint,
      sampleInput: best.sampleInput,
    });
  }
  return candidates
    .sort((a,b) => b.score - a.score || a.priceUsd - b.priceUsd || a.productId.localeCompare(b.productId))
    .slice(0, Math.min(20, Math.max(1, limit)));
}

export function quoteRouterIntent(args: { intent?: unknown; productId?: unknown }) {
  const productId = normalize(args.productId);
  if (productId) {
    const route = staticRevenueProductRoutes().find(r => normalize(r.id) === productId);
    if (!route) return { ok: false as const, reason: "unknown-or-unconfigured-product", candidates: [] as RouterCandidate[] };
    const candidate: RouterCandidate = {
      productId: route.id,
      title: route.title,
      description: route.description,
      tier: route.tier,
      priceUsd: REVENUE_TIER_PRICE[route.tier],
      score: 100,
      alias: route.alias,
      productUrl: route.path,
      executeUrl: `/api/router/execute/${route.tier}`,
      inputHint: route.inputHint,
      sampleInput: route.sampleInput,
    };
    return { ok: true as const, confidence: "explicit" as const, quote: candidate };
  }

  const intent = String(args.intent ?? "").trim();
  if (!intent) return { ok: false as const, reason: "intent-required", candidates: [] as RouterCandidate[] };
  const candidates = findRouterCandidates(intent, 5);
  if (!candidates.length) return { ok: false as const, reason: "no-match", candidates };
  const best = candidates[0];
  const runnerUp = candidates[1];
  const margin = best.score - (runnerUp?.score ?? 0);
  // High-confidence only. The free find endpoint can still surface weaker
  // candidates, but paid execute must not charge for a fuzzy/wrong match.
  if (best.score < 56 || (best.score < 82 && margin < 14)) {
    return { ok: false as const, reason: "ambiguous", candidates };
  }
  return { ok: true as const, confidence: best.score >= 88 ? "high" as const : "medium" as const, quote: best, candidates };
}

function executionInput(body: any) {
  if (Object.prototype.hasOwnProperty.call(body || {}, "input")) return body.input;
  if (Object.prototype.hasOwnProperty.call(body || {}, "payload")) return body.payload;
  if (Object.prototype.hasOwnProperty.call(body || {}, "args")) return body.args;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const clone: Record<string, unknown> = { ...body };
  delete clone.intent;
  delete clone.productId;
  delete clone.product_id;
  return clone;
}

export async function executeRouterTier(tier: RevenueTier, body: any) {
  const productId = body?.productId ?? body?.product_id;
  if (!productId) {
    throw new Error("productId is required for paid execution; call the free /api/router/quote endpoint first");
  }
  const resolution = quoteRouterIntent({ productId });
  if (!resolution.ok) {
    throw new Error(`router product is unavailable (${resolution.reason})`);
  }
  const quote = resolution.quote;
  if (quote.tier !== tier) {
    throw new Error(`price tier mismatch; quote requires ${quote.executeUrl} at $${quote.priceUsd.toFixed(3)}`);
  }
  const result = await runRevenueProduct(`${quote.productId}--router`, tier, executionInput(body));
  return {
    ok: true,
    router: "PennyRail Transaction Router v37",
    intent: body?.intent ?? null,
    productId: quote.productId,
    title: quote.title,
    priceUsd: quote.priceUsd,
    tier,
    routing: { source: "pennyrail-owned", confidence: resolution.confidence, upstreamBrokered: false },
    result: result.result,
  };
}

export const ROUTER_TIERS: RevenueTier[] = ["nano","mini","network","micro","intel","standard","premium","skill","analyst"];
