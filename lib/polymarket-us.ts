import { createPrivateKey, sign as cryptoSign } from "node:crypto";

const INCENTIVES_API = "https://api.prod.polymarketexchange.com/v1/incentives";
const PUBLIC_GATEWAY = "https://gateway.polymarket.us";
const TRADING_API = "https://api.polymarket.us";
const TARGET_NET_USD_PER_DAY = 1_000;
const MAX_PROGRAMS_TO_BOOK_SAMPLE = 12;
const MAX_MARKETS_PER_PROGRAM_SAMPLE = 4;

export type PolymarketUSConfig = {
  live: boolean;
  configured: boolean;
  armed: boolean;
  killSwitch: boolean;
  maxCapitalUsd: number;
};

export type PolymarketRewardCandidate = {
  programId: string;
  programType: string;
  period: string | null;
  rewardPoolUsd: number;
  dailyizedRewardPoolUsd: number;
  start: string | null;
  end: string | null;
  targetSizeContracts: number | null;
  discountFactor: number | null;
  marketCount: number;
  sampledMarkets: number;
  representativeMarketSlug: string | null;
  medianCheapSideCapitalUsd: number | null;
  bestCheapSideCapitalUsd: number | null;
  medianBestLevelCompetitionContracts: number | null;
  medianTargetOrderShareAtBest: number | null;
  equalSideProgramShareGrossUsdPerDay: number | null;
  sampledCompetitionGrossUsdPerSidePerDay: number | null;
  estimatedSidesNeededFor1000Gross: number | null;
  estimatedCapitalFor1000GrossUsd: number | null;
  scaleCapacity: boolean;
};

export type PolymarketUSScan = {
  ok: boolean;
  accountingVersion: 2;
  generatedAt: string;
  activeMarkets: number;
  activeProgramPeriods: number;
  totalRewardPoolUsd: number;
  totalDailyizedRewardPoolUsd: number;
  programsWithAtLeast1000DailyPool: number;
  programsWithAtLeast5000DailyPool: number;
  largestDailyizedPoolUsd: number;
  top: PolymarketRewardCandidate[];
  liveCapability: PolymarketUSConfig;
  note: string;
  error: string | null;
};

type ProgramGroup = {
  key: string;
  programId: string;
  programType: string;
  period: string | null;
  rewardPoolUsd: number;
  dailyizedRewardPoolUsd: number;
  start: string | null;
  end: string | null;
  targetSizeContracts: number | null;
  discountFactor: number | null;
  marketSlugs: string[];
};

type Book = {
  bestBid: number | null;
  bestAsk: number | null;
  bestBidQty: number;
  bestAskQty: number;
};

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function median(values: number[]) {
  const rows = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!rows.length) return null;
  const mid = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[mid] : (rows[mid - 1] + rows[mid]) / 2;
}

function price(value: unknown): number | null {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct >= 0 && direct <= 1) return direct;
  const objectValue = Number((value as any)?.value);
  return Number.isFinite(objectValue) && objectValue >= 0 && objectValue <= 1
    ? objectValue
    : null;
}

function quantity(value: unknown) {
  return Math.max(0, num(value));
}

function envBool(name: string) {
  return /^(1|true|yes|on)$/i.test(process.env[name]?.trim() || "");
}

export function polymarketUSConfig(): PolymarketUSConfig {
  const live = envBool("POLYMARKET_US_LIVE");
  const killSwitch = envBool("POLYMARKET_US_KILL_SWITCH");
  const keyId = process.env.POLYMARKET_US_KEY_ID?.trim() || "";
  const secretKey = process.env.POLYMARKET_US_SECRET_KEY?.trim() || "";
  const configured = Boolean(keyId && secretKey);
  const maxCapitalUsd = Math.max(0, num(process.env.POLYMARKET_US_MAX_CAPITAL_USD));
  return {
    live,
    configured,
    killSwitch,
    maxCapitalUsd,
    armed: live && configured && !killSwitch && maxCapitalUsd > 0,
  };
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 12_000) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "PennyRail-Scale-Gate/2.0",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await response.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) {
    throw new Error(`Polymarket US ${new URL(url).pathname} HTTP ${response.status}: ${raw.slice(0, 300)}`);
  }
  return body;
}

async function incentivePages() {
  const all: any[] = [];
  let pageToken = "";
  for (let page = 0; page < 12; page += 1) {
    const url = new URL(INCENTIVES_API);
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("statuses", "active");
    url.searchParams.set("orderBy", "reward");
    url.searchParams.set("orderDirection", "desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const body = await fetchJson(url.toString());
    const rows = Array.isArray(body?.programs) ? body.programs : [];
    all.push(...rows);
    pageToken = String(body?.nextPageToken || "");
    if (!pageToken || rows.length === 0) break;
  }
  return all;
}

function activePeriod(row: any) {
  const now = Date.now();
  const start = Date.parse(String(row?.start || ""));
  const end = Date.parse(String(row?.end || ""));
  const status = String(row?.status || "").toLowerCase();
  if (status && status !== "active") return false;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end <= now) return false;
  return true;
}

function dailyizedReward(row: any) {
  const reward = Math.max(0, num(row?.rewardPool));
  const start = Date.parse(String(row?.start || ""));
  const end = Date.parse(String(row?.end || ""));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return reward;
  const hours = Math.max(1, (end - start) / 3_600_000);
  return hours <= 24 ? reward : reward * (24 / hours);
}

function programKey(period: any) {
  const id = String(period?.programId || "").trim();
  const start = String(period?.start || "");
  const end = String(period?.end || "");
  const label = String(period?.period || "");
  // programId is the primary shared-pool identifier. Start/end/period prevent a
  // reused identifier in a later lifecycle window from being merged accidentally.
  return `${id}|${start}|${end}|${label}`;
}

function groupPrograms(rows: any[]): ProgramGroup[] {
  const map = new Map<string, ProgramGroup>();
  for (const row of rows) {
    const marketSlug = String(row?.marketSlug || "").trim();
    if (!marketSlug) continue;
    for (const period of Array.isArray(row?.timePeriods) ? row.timePeriods : []) {
      if (!activePeriod(period)) continue;
      const key = programKey(period);
      const programId = String(period?.programId || "").trim();
      if (!programId) continue;
      const existing = map.get(key);
      if (existing) {
        if (!existing.marketSlugs.includes(marketSlug)) existing.marketSlugs.push(marketSlug);
        // The pool is shared by the program. Never add rewardPool again here.
        continue;
      }
      const targetRaw = num(period?.targetSize, NaN);
      map.set(key, {
        key,
        programId,
        programType: String(period?.programType || "unknown"),
        period: period?.period ? String(period.period) : null,
        rewardPoolUsd: round(Math.max(0, num(period?.rewardPool))),
        dailyizedRewardPoolUsd: round(Math.max(0, dailyizedReward(period))),
        start: period?.start ? String(period.start) : null,
        end: period?.end ? String(period.end) : null,
        targetSizeContracts: Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : null,
        discountFactor: Number.isFinite(Number(period?.discountFactor)) ? Number(period.discountFactor) : null,
        marketSlugs: [marketSlug],
      });
    }
  }
  return [...map.values()];
}

async function bookFor(slug: string): Promise<Book> {
  try {
    const body = await fetchJson(`${PUBLIC_GATEWAY}/v1/markets/${encodeURIComponent(slug)}/book`, {}, 7_000);
    const market = body?.marketData || body?.data?.marketData || body?.data || body || {};
    const bids = Array.isArray(market?.bids) ? market.bids : [];
    const offers = Array.isArray(market?.offers) ? market.offers : [];
    const parsedBids = bids.map((row: any) => ({ px: price(row?.px), qty: quantity(row?.qty) })).filter((row: any) => row.px != null);
    const parsedOffers = offers.map((row: any) => ({ px: price(row?.px), qty: quantity(row?.qty) })).filter((row: any) => row.px != null);
    const bestBid = parsedBids.length ? Math.max(...parsedBids.map((row: any) => row.px as number)) : null;
    const bestAsk = parsedOffers.length ? Math.min(...parsedOffers.map((row: any) => row.px as number)) : null;
    const bestBidQty = bestBid == null ? 0 : parsedBids.filter((row: any) => Math.abs((row.px as number) - bestBid) < 1e-9).reduce((sum: number, row: any) => sum + row.qty, 0);
    const bestAskQty = bestAsk == null ? 0 : parsedOffers.filter((row: any) => Math.abs((row.px as number) - bestAsk) < 1e-9).reduce((sum: number, row: any) => sum + row.qty, 0);
    return { bestBid, bestAsk, bestBidQty, bestAskQty };
  } catch {
    return { bestBid: null, bestAsk: null, bestBidQty: 0, bestAskQty: 0 };
  }
}

function preRank(group: ProgramGroup) {
  // If each market has two independently-normalized sides, this is the gross
  // pool share of one fully dominated side before observed competition. It is a
  // screening yardstick, not a payout forecast.
  const sideCount = Math.max(1, group.marketSlugs.length * 2);
  return group.dailyizedRewardPoolUsd / sideCount;
}

async function enrichGroup(group: ProgramGroup): Promise<PolymarketRewardCandidate> {
  const sampleSlugs = group.marketSlugs.slice(0, MAX_MARKETS_PER_PROGRAM_SAMPLE);
  const books = await Promise.all(sampleSlugs.map(bookFor));
  const target = group.targetSizeContracts;
  const cheapCapital: number[] = [];
  const competition: number[] = [];
  const targetShares: number[] = [];

  if (target) {
    for (const book of books) {
      const candidates: Array<{ unitCost: number; competition: number }> = [];
      if (book.bestBid != null && book.bestBid > 0 && book.bestBid < 1) {
        candidates.push({ unitCost: book.bestBid, competition: book.bestBidQty });
      }
      // A YES offer at A corresponds to a NO bid at (1-A).
      if (book.bestAsk != null && book.bestAsk > 0 && book.bestAsk < 1) {
        candidates.push({ unitCost: 1 - book.bestAsk, competition: book.bestAskQty });
      }
      if (!candidates.length) continue;
      candidates.sort((a, b) => a.unitCost - b.unitCost);
      const chosen = candidates[0];
      cheapCapital.push(target * chosen.unitCost);
      competition.push(chosen.competition);
      targetShares.push(target / Math.max(target, target + chosen.competition));
    }
  }

  const marketCount = group.marketSlugs.length;
  const equalSideGross = marketCount > 0
    ? group.dailyizedRewardPoolUsd / (marketCount * 2)
    : null;
  const medianShare = median(targetShares);
  const sampledCompetitionGross = equalSideGross != null && medianShare != null
    ? equalSideGross * medianShare
    : null;
  const sidesNeeded = sampledCompetitionGross && sampledCompetitionGross > 0
    ? Math.ceil(TARGET_NET_USD_PER_DAY / sampledCompetitionGross)
    : null;
  const medianCapital = median(cheapCapital);
  const estCapital = sidesNeeded != null && medianCapital != null
    ? sidesNeeded * medianCapital
    : null;

  return {
    programId: group.programId,
    programType: group.programType,
    period: group.period,
    rewardPoolUsd: group.rewardPoolUsd,
    dailyizedRewardPoolUsd: group.dailyizedRewardPoolUsd,
    start: group.start,
    end: group.end,
    targetSizeContracts: group.targetSizeContracts,
    discountFactor: group.discountFactor,
    marketCount,
    sampledMarkets: books.length,
    representativeMarketSlug: group.marketSlugs[0] || null,
    medianCheapSideCapitalUsd: medianCapital == null ? null : round(medianCapital),
    bestCheapSideCapitalUsd: cheapCapital.length ? round(Math.min(...cheapCapital)) : null,
    medianBestLevelCompetitionContracts: median(competition) == null ? null : round(median(competition)!, 0),
    medianTargetOrderShareAtBest: medianShare == null ? null : round(medianShare, 4),
    equalSideProgramShareGrossUsdPerDay: equalSideGross == null ? null : round(equalSideGross),
    sampledCompetitionGrossUsdPerSidePerDay: sampledCompetitionGross == null ? null : round(sampledCompetitionGross),
    estimatedSidesNeededFor1000Gross: sidesNeeded,
    estimatedCapitalFor1000GrossUsd: estCapital == null ? null : round(estCapital),
    scaleCapacity: group.dailyizedRewardPoolUsd >= TARGET_NET_USD_PER_DAY,
  };
}

export async function scanPolymarketUSScaleOpportunity(): Promise<PolymarketUSScan> {
  const cfg = polymarketUSConfig();
  try {
    const rows = await incentivePages();
    const groups = groupPrograms(rows);
    const activeMarkets = new Set(groups.flatMap(group => group.marketSlugs)).size;
    const ranked = [...groups]
      .sort((a, b) => {
        const aScore = preRank(a);
        const bScore = preRank(b);
        return bScore - aScore || b.dailyizedRewardPoolUsd - a.dailyizedRewardPoolUsd;
      })
      .slice(0, MAX_PROGRAMS_TO_BOOK_SAMPLE);
    const enriched = await Promise.all(ranked.map(enrichGroup));
    enriched.sort((a, b) => {
      const ac = a.estimatedCapitalFor1000GrossUsd ?? Number.POSITIVE_INFINITY;
      const bc = b.estimatedCapitalFor1000GrossUsd ?? Number.POSITIVE_INFINITY;
      return ac - bc || b.dailyizedRewardPoolUsd - a.dailyizedRewardPoolUsd;
    });

    const totalRewardPoolUsd = groups.reduce((sum, group) => sum + group.rewardPoolUsd, 0);
    const totalDailyizedRewardPoolUsd = groups.reduce((sum, group) => sum + group.dailyizedRewardPoolUsd, 0);
    const programsWithAtLeast1000DailyPool = groups.filter(group => group.dailyizedRewardPoolUsd >= 1_000).length;
    const programsWithAtLeast5000DailyPool = groups.filter(group => group.dailyizedRewardPoolUsd >= 5_000).length;
    const largestDailyizedPoolUsd = groups.reduce((max, group) => Math.max(max, group.dailyizedRewardPoolUsd), 0);

    return {
      ok: true,
      accountingVersion: 2,
      generatedAt: new Date().toISOString(),
      activeMarkets,
      activeProgramPeriods: groups.length,
      totalRewardPoolUsd: round(totalRewardPoolUsd),
      totalDailyizedRewardPoolUsd: round(totalDailyizedRewardPoolUsd),
      programsWithAtLeast1000DailyPool,
      programsWithAtLeast5000DailyPool,
      largestDailyizedPoolUsd: round(largestDailyizedPoolUsd),
      top: enriched.slice(0, 8),
      liveCapability: cfg,
      note: "Corrected v68 accounting: rewardPool is counted once per shared program/time period, never once per market. Program-level capital/share figures are screening estimates from sampled books; they are not forecast profit and do not authorize capital.",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      accountingVersion: 2,
      generatedAt: new Date().toISOString(),
      activeMarkets: 0,
      activeProgramPeriods: 0,
      totalRewardPoolUsd: 0,
      totalDailyizedRewardPoolUsd: 0,
      programsWithAtLeast1000DailyPool: 0,
      programsWithAtLeast5000DailyPool: 0,
      largestDailyizedPoolUsd: 0,
      top: [],
      liveCapability: cfg,
      note: "Corrected public incentive scan failed; no capital action is permitted on missing data.",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function keyId() { return process.env.POLYMARKET_US_KEY_ID?.trim() || ""; }
function secretKey() { return process.env.POLYMARKET_US_SECRET_KEY?.trim() || ""; }

function ed25519PrivateKey() {
  const raw = Buffer.from(secretKey(), "base64");
  if (raw.length < 32) throw new Error("POLYMARKET_US_SECRET_KEY must be a Base64 Ed25519 private key");
  const seed = raw.subarray(0, 32);
  // RFC8410 PKCS#8 prefix for a raw 32-byte Ed25519 seed.
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  return createPrivateKey({ key: Buffer.concat([prefix, seed]), format: "der", type: "pkcs8" });
}

function authHeaders(method: string, path: string) {
  if (!keyId() || !secretKey()) throw new Error("Polymarket US credentials are not configured");
  const timestamp = String(Date.now());
  const message = Buffer.from(`${timestamp}${method.toUpperCase()}${path}`);
  const signature = cryptoSign(null, message, ed25519PrivateKey()).toString("base64");
  return {
    "X-PM-Access-Key": keyId(),
    "X-PM-Timestamp": timestamp,
    "X-PM-Signature": signature,
  };
}

async function authenticated(path: string, init: RequestInit = {}) {
  const method = String(init.method || "GET").toUpperCase();
  return fetchJson(`${TRADING_API}${path}`, {
    ...init,
    headers: { ...authHeaders(method, path), ...(init.headers || {}) },
  }, 15_000);
}

function assertArmed() {
  const cfg = polymarketUSConfig();
  if (!cfg.live) throw new Error("POLYMARKET_US_LIVE is false");
  if (cfg.killSwitch) throw new Error("Polymarket US kill switch is active");
  if (!cfg.configured) throw new Error("Polymarket US credentials are not configured");
  if (!(cfg.maxCapitalUsd > 0)) throw new Error("POLYMARKET_US_MAX_CAPITAL_USD must be positive");
  return cfg;
}

function orderNotional(order: any) {
  const quantityContracts = Math.max(0, num(order?.quantity));
  const yesPrice = Math.max(0, num(order?.price?.value ?? order?.price));
  const intent = String(order?.intent || "ORDER_INTENT_BUY_LONG");
  if (!(quantityContracts > 0) || !(yesPrice > 0 && yesPrice < 1)) {
    throw new Error("positive quantity and a 0-1 limit price are required");
  }
  const unitCost = intent === "ORDER_INTENT_BUY_SHORT" ? 1 - yesPrice : yesPrice;
  return quantityContracts * Math.max(0, unitCost);
}

export async function polymarketUSReconcile() {
  const cfg = polymarketUSConfig();
  if (!cfg.configured) return { capability: cfg, configured: false };
  const [balances, orders, positions, activities] = await Promise.allSettled([
    authenticated("/v1/account/balances"),
    authenticated("/v1/orders/open"),
    authenticated("/v1/portfolio/positions"),
    authenticated("/v1/portfolio/activities?limit=50"),
  ]);
  const value = (row: PromiseSettledResult<any>) => row.status === "fulfilled" ? row.value : { error: String(row.reason) };
  return { capability: cfg, configured: true, balances: value(balances), openOrders: value(orders), positions: value(positions), activities: value(activities) };
}

export async function previewPolymarketUSOrder(order: any) {
  const cfg = polymarketUSConfig();
  if (!cfg.configured) throw new Error("Polymarket US credentials are not configured");
  const notional = orderNotional(order);
  if (cfg.maxCapitalUsd > 0 && notional > cfg.maxCapitalUsd + 1e-9) {
    throw new Error(`order notional $${notional.toFixed(2)} exceeds Polymarket US capital cap $${cfg.maxCapitalUsd.toFixed(2)}`);
  }
  return authenticated("/v1/order/preview", {
    method: "POST",
    body: JSON.stringify({
      marketSlug: String(order?.marketSlug || ""),
      intent: String(order?.intent || "ORDER_INTENT_BUY_LONG"),
      type: "ORDER_TYPE_LIMIT",
      price: { value: num(order?.price?.value ?? order?.price).toFixed(4), currency: "USD" },
      quantity: Math.max(0, num(order?.quantity)),
      tif: String(order?.tif || "TIME_IN_FORCE_GOOD_TILL_CANCEL"),
      participateDontInitiate: true,
      manualOrderIndicator: "MANUAL_ORDER_INDICATOR_AUTOMATIC",
    }),
  });
}

export async function placePolymarketUSOrder(order: any) {
  const cfg = assertArmed();
  const notional = orderNotional(order);
  if (notional > cfg.maxCapitalUsd + 1e-9) {
    throw new Error(`order notional $${notional.toFixed(2)} exceeds Polymarket US capital cap $${cfg.maxCapitalUsd.toFixed(2)}`);
  }
  const body = {
    marketSlug: String(order?.marketSlug || ""),
    intent: String(order?.intent || "ORDER_INTENT_BUY_LONG"),
    type: "ORDER_TYPE_LIMIT",
    price: { value: num(order?.price?.value ?? order?.price).toFixed(4), currency: "USD" },
    quantity: Math.max(0, num(order?.quantity)),
    tif: String(order?.tif || "TIME_IN_FORCE_GOOD_TILL_CANCEL"),
    participateDontInitiate: true,
    manualOrderIndicator: "MANUAL_ORDER_INDICATOR_AUTOMATIC",
  };
  await authenticated("/v1/order/preview", { method: "POST", body: JSON.stringify(body) });
  return authenticated("/v1/orders", { method: "POST", body: JSON.stringify(body) });
}

export async function cancelPolymarketUSOrder(orderId: string, marketSlug: string) {
  if (!orderId || !marketSlug) throw new Error("orderId and marketSlug are required");
  if (!polymarketUSConfig().configured) throw new Error("Polymarket US credentials are not configured");
  return authenticated(`/v1/order/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ marketSlug }),
  });
}

export async function cancelAllPolymarketUSOrders(marketSlug?: string | null) {
  if (!polymarketUSConfig().configured) throw new Error("Polymarket US credentials are not configured");
  return authenticated("/v1/orders/open/cancel", {
    method: "POST",
    body: JSON.stringify(marketSlug ? { marketSlug } : {}),
  });
}
