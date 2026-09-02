import { createPrivateKey, sign as cryptoSign } from "node:crypto";

const INCENTIVES_API = "https://api.prod.polymarketexchange.com/v1/incentives";
const PUBLIC_GATEWAY = "https://gateway.polymarket.us";
const TRADING_API = "https://api.polymarket.us";

export type PolymarketUSConfig = {
  live: boolean;
  configured: boolean;
  armed: boolean;
  killSwitch: boolean;
  maxCapitalUsd: number;
};

export type PolymarketRewardCandidate = {
  marketSlug: string;
  programId: string;
  programType: string;
  period: string | null;
  rewardPoolUsd: number;
  dailyizedRewardPoolUsd: number;
  start: string | null;
  end: string | null;
  targetSizeContracts: number | null;
  discountFactor: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  midpoint: number | null;
  spread: number | null;
  bestBidQty: number;
  bestAskQty: number;
  visibleBidQty: number;
  visibleAskQty: number;
  indicativeFullTargetCapitalUsd: number | null;
  visibleCompetitionShareUpper: number | null;
  visibleBookGrossRewardUpperUsdPerDay: number | null;
  poolToTargetCapitalRatio: number | null;
  scaleCapacity: boolean;
};

export type PolymarketUSScan = {
  ok: boolean;
  generatedAt: string;
  activeMarkets: number;
  activePeriods: number;
  totalRewardPoolUsd: number;
  totalDailyizedRewardPoolUsd: number;
  marketsWithAtLeast1000DailyPool: number;
  marketsWithAtLeast5000DailyPool: number;
  largestDailyizedPoolUsd: number;
  top: PolymarketRewardCandidate[];
  liveCapability: PolymarketUSConfig;
  note: string;
  error: string | null;
};

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
      "user-agent": "PennyRail-Scale-Gate/1.0",
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
  for (let page = 0; page < 8; page += 1) {
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
  // A short live window does not magically create more dollars by annualizing
  // its pool. For <=24h periods, the whole pool is the maximum money available
  // in that window. Longer periods are conservatively spread across days.
  return hours <= 24 ? reward : reward * (24 / hours);
}

async function bookFor(slug: string) {
  try {
    const body = await fetchJson(`${PUBLIC_GATEWAY}/v1/markets/${encodeURIComponent(slug)}/book`, {}, 8_000);
    const market = body?.marketData || body?.data?.marketData || body?.data || body || {};
    const bids = Array.isArray(market?.bids) ? market.bids : [];
    const offers = Array.isArray(market?.offers) ? market.offers : [];
    const parsedBids = bids.map((row: any) => ({ px: price(row?.px), qty: quantity(row?.qty) })).filter((row: any) => row.px != null);
    const parsedOffers = offers.map((row: any) => ({ px: price(row?.px), qty: quantity(row?.qty) })).filter((row: any) => row.px != null);
    const bestBid = parsedBids.length ? Math.max(...parsedBids.map((row: any) => row.px as number)) : null;
    const bestAsk = parsedOffers.length ? Math.min(...parsedOffers.map((row: any) => row.px as number)) : null;
    const bestBidQty = bestBid == null ? 0 : parsedBids.filter((row: any) => Math.abs(row.px - bestBid) < 1e-9).reduce((sum: number, row: any) => sum + row.qty, 0);
    const bestAskQty = bestAsk == null ? 0 : parsedOffers.filter((row: any) => Math.abs(row.px - bestAsk) < 1e-9).reduce((sum: number, row: any) => sum + row.qty, 0);
    const visibleBidQty = parsedBids.slice(0, 5).reduce((sum: number, row: any) => sum + row.qty, 0);
    const visibleAskQty = parsedOffers.slice(0, 5).reduce((sum: number, row: any) => sum + row.qty, 0);
    return { bestBid, bestAsk, bestBidQty, bestAskQty, visibleBidQty, visibleAskQty };
  } catch {
    return { bestBid: null, bestAsk: null, bestBidQty: 0, bestAskQty: 0, visibleBidQty: 0, visibleAskQty: 0 };
  }
}

export async function scanPolymarketUSScaleOpportunity(): Promise<PolymarketUSScan> {
  const cfg = polymarketUSConfig();
  try {
    const programs = await incentivePages();
    const flattened: Array<{ marketSlug: string; period: any }> = [];
    for (const program of programs) {
      const marketSlug = String(program?.marketSlug || "").trim();
      if (!marketSlug) continue;
      const periods = Array.isArray(program?.timePeriods) ? program.timePeriods : [];
      for (const period of periods) {
        if (activePeriod(period)) flattened.push({ marketSlug, period });
      }
    }

    const ranked = flattened
      .map(({ marketSlug, period }) => ({ marketSlug, period, daily: dailyizedReward(period) }))
      .sort((a, b) => b.daily - a.daily)
      .slice(0, 16);

    const books = await Promise.all(ranked.map(row => bookFor(row.marketSlug)));
    const top: PolymarketRewardCandidate[] = ranked.map((row, index) => {
      const p = row.period;
      const book = books[index];
      const targetSize = num(p?.targetSize, NaN);
      const target = Number.isFinite(targetSize) && targetSize > 0 ? targetSize : null;
      const spread = book.bestBid != null && book.bestAsk != null
        ? Math.max(0, book.bestAsk - book.bestBid)
        : null;
      const midpoint = book.bestBid != null && book.bestAsk != null
        ? (book.bestBid + book.bestAsk) / 2
        : book.bestBid ?? book.bestAsk;
      const daily = Math.max(0, row.daily);
      const visibleBestCompetition = Math.max(book.bestBidQty, book.bestAskQty);
      const visibleShareUpper = target
        ? target / Math.max(target, target + visibleBestCompetition)
        : null;
      const grossUpper = visibleShareUpper == null ? null : daily * visibleShareUpper;
      // For a balanced YES/NO buy pair, $1 of collateral buys one complete pair.
      // This deliberately uses target contracts as a conservative capital yardstick.
      const fullTargetCapital = target;
      return {
        marketSlug: row.marketSlug,
        programId: String(p?.programId || ""),
        programType: String(p?.programType || "unknown"),
        period: p?.period ? String(p.period) : null,
        rewardPoolUsd: Number(Math.max(0, num(p?.rewardPool)).toFixed(2)),
        dailyizedRewardPoolUsd: Number(daily.toFixed(2)),
        start: p?.start ? String(p.start) : null,
        end: p?.end ? String(p.end) : null,
        targetSizeContracts: target,
        discountFactor: Number.isFinite(Number(p?.discountFactor)) ? Number(p.discountFactor) : null,
        bestBid: book.bestBid,
        bestAsk: book.bestAsk,
        midpoint: midpoint == null ? null : Number(midpoint.toFixed(4)),
        spread: spread == null ? null : Number(spread.toFixed(4)),
        bestBidQty: Number(book.bestBidQty.toFixed(2)),
        bestAskQty: Number(book.bestAskQty.toFixed(2)),
        visibleBidQty: Number(book.visibleBidQty.toFixed(2)),
        visibleAskQty: Number(book.visibleAskQty.toFixed(2)),
        indicativeFullTargetCapitalUsd: fullTargetCapital,
        visibleCompetitionShareUpper: visibleShareUpper == null ? null : Number(visibleShareUpper.toFixed(4)),
        visibleBookGrossRewardUpperUsdPerDay: grossUpper == null ? null : Number(grossUpper.toFixed(2)),
        poolToTargetCapitalRatio: target ? Number((daily / target).toFixed(4)) : null,
        scaleCapacity: daily >= 1_000,
      };
    });

    const totalRewardPoolUsd = flattened.reduce((sum, row) => sum + Math.max(0, num(row.period?.rewardPool)), 0);
    const totalDailyizedRewardPoolUsd = flattened.reduce((sum, row) => sum + Math.max(0, dailyizedReward(row.period)), 0);
    const marketsWithAtLeast1000DailyPool = flattened.filter(row => dailyizedReward(row.period) >= 1_000).length;
    const marketsWithAtLeast5000DailyPool = flattened.filter(row => dailyizedReward(row.period) >= 5_000).length;
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      activeMarkets: new Set(flattened.map(row => row.marketSlug)).size,
      activePeriods: flattened.length,
      totalRewardPoolUsd: Number(totalRewardPoolUsd.toFixed(2)),
      totalDailyizedRewardPoolUsd: Number(totalDailyizedRewardPoolUsd.toFixed(2)),
      marketsWithAtLeast1000DailyPool,
      marketsWithAtLeast5000DailyPool,
      largestDailyizedPoolUsd: Number((top[0]?.dailyizedRewardPoolUsd || 0).toFixed(2)),
      top: top.slice(0, 8),
      liveCapability: cfg,
      note: "Reward pools are external capacity, not forecast profit. Visible-book reward share is an optimistic screening bound only; PennyRail will not deploy capital until repeated paper observations support positive net economics.",
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      generatedAt: new Date().toISOString(),
      activeMarkets: 0,
      activePeriods: 0,
      totalRewardPoolUsd: 0,
      totalDailyizedRewardPoolUsd: 0,
      marketsWithAtLeast1000DailyPool: 0,
      marketsWithAtLeast5000DailyPool: 0,
      largestDailyizedPoolUsd: 0,
      top: [],
      liveCapability: cfg,
      note: "Public incentive scan failed; no capital action is permitted on missing data.",
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
