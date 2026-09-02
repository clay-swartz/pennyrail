import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { normalizeSignals, type PermitRailCity, type PermitRailSignal, type PermitRailTrade } from "@/lib/permitrail-core";
import { scanPermitRailSources, type PermitRailSourceHealth } from "@/lib/permitrail-sources";

const NTFY = "https://ntfy.sh";
const SCHEDULER = "https://aisenseapi.com/services/v1/webhook_schedule";
const REFRESH_SECONDS = 30 * 60;

export type PermitRailState = {
  v: 1;
  startedAt: string;
  lastRefreshAt: string | null;
  nextRefreshAt: string | null;
  refreshCount: number;
  totalSignals: number;
  hotSignals: number;
  warmSignals: number;
  sourceHealth: PermitRailSourceHealth[];
  cities: Array<{ city: PermitRailCity; count: number; hot: number }>;
  trades: Array<{ trade: PermitRailTrade; count: number; hot: number }>;
  top: Array<{ id: string; city: PermitRailCity; primaryTrade: PermitRailTrade; score: number; estimatedOpportunityValueUsd: number | null; ageHours: number | null }>;
  scheduler: { ok: boolean; lastScheduledAt: string | null; error: string | null };
  distribution: { lastAttemptAt: string | null; agent402Ok: boolean | null; x402DashFeedOk: boolean | null; x402DashTerritoryOk: boolean | null; error: string | null };
  errors: string[];
};

export type PermitRailFilters = {
  city?: PermitRailCity | "all" | null;
  trade?: PermitRailTrade | "all" | null;
  minScore?: number | null;
  maxAgeHours?: number | null;
  limit?: number | null;
};

function secret() {
  return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || "";
}

function topic() {
  const s = secret();
  if (!s) throw new Error("PermitRail state secret unavailable");
  return `pennyrail-${createHash("sha256").update(`permitrail-v1:${s}`).digest("hex").slice(0, 40)}`;
}

function safeEqual(a: string, b: string) {
  try {
    const aa = Buffer.from(a), bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch { return false; }
}

function tokenForSlot(slot: number) {
  return createHmac("sha256", secret()).update(`permitrail-refresh-v1:${slot}`).digest("hex");
}

export function verifyPermitRailRefreshToken(slot: number, token: string) {
  if (!secret() || !Number.isInteger(slot) || slot <= 0 || !token) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - slot) > 45 * 60) return false;
  return safeEqual(token, tokenForSlot(slot));
}

function blank(): PermitRailState {
  return {
    v: 1,
    startedAt: new Date().toISOString(),
    lastRefreshAt: null,
    nextRefreshAt: null,
    refreshCount: 0,
    totalSignals: 0,
    hotSignals: 0,
    warmSignals: 0,
    sourceHealth: [],
    cities: [],
    trades: [],
    top: [],
    scheduler: { ok: false, lastScheduledAt: null, error: null },
    distribution: { lastAttemptAt: null, agent402Ok: null, x402DashFeedOk: null, x402DashTerritoryOk: null, error: null },
    errors: [],
  };
}

export async function loadPermitRailState(): Promise<PermitRailState | null> {
  try {
    const r = await fetch(`${NTFY}/${encodeURIComponent(topic())}/json?poll=1&since=latest`, {
      headers: { accept: "application/x-ndjson,application/json" }, cache: "no-store", signal: AbortSignal.timeout(7_000),
    });
    if (!r.ok) return null;
    const rows = (await r.text()).split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(row => row?.event === "message" && typeof row?.message === "string");
    if (!rows.length) return null;
    const parsed = JSON.parse(rows[rows.length - 1].message);
    return parsed?.v === 1 ? parsed as PermitRailState : null;
  } catch { return null; }
}

export async function savePermitRailState(state: PermitRailState) {
  state.sourceHealth = state.sourceHealth.slice(0, 8).map(row => ({ ...row, error: row.error ? row.error.slice(0, 180) : null }));
  state.cities = state.cities.slice(0, 8);
  state.trades = state.trades.slice(0, 12);
  state.top = state.top.slice(0, 8);
  state.errors = state.errors.slice(0, 5).map(row => row.slice(0, 220));
  let raw = JSON.stringify(state);
  if (raw.length > 3400) {
    state.top = state.top.slice(0, 3);
    state.trades = state.trades.slice(0, 8);
    state.errors = state.errors.slice(0, 2);
    raw = JSON.stringify(state);
  }
  if (raw.length > 3900) {
    state.top = state.top.slice(0, 1);
    state.trades = state.trades.slice(0, 4);
    state.sourceHealth = state.sourceHealth.map(row => ({ ...row, error: row.error ? row.error.slice(0, 80) : null }));
  }
  const r = await fetch(`${NTFY}/`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ topic: topic(), title: "PennyRail PermitRail state", message: JSON.stringify(state), priority: 1 }),
    cache: "no-store",
    signal: AbortSignal.timeout(7_000),
  });
  if (!r.ok) throw new Error(`PermitRail state write HTTP ${r.status}`);
}

function byCount<T extends string>(signals: PermitRailSignal[], value: (s: PermitRailSignal) => T) {
  const map = new Map<T, { count: number; hot: number }>();
  for (const signal of signals) {
    const key = value(signal);
    const cur = map.get(key) || { count: 0, hot: 0 };
    cur.count += 1;
    if (signal.urgency === "hot") cur.hot += 1;
    map.set(key, cur);
  }
  return [...map.entries()].map(([key, counts]) => ({ key, ...counts })).sort((a, b) => b.hot - a.hot || b.count - a.count);
}

export async function buildPermitRailFeed(filters: PermitRailFilters = {}) {
  const scan = await scanPermitRailSources(250);
  const all = normalizeSignals(scan.rows);
  const minScore = Math.max(0, Math.min(100, Number(filters.minScore ?? 45)));
  const maxAge = Math.max(1, Math.min(90 * 24, Number(filters.maxAgeHours ?? 30 * 24)));
  const limit = Math.max(1, Math.min(500, Number(filters.limit ?? 100)));
  const signals = all.filter(signal => {
    if (filters.city && filters.city !== "all" && signal.city !== filters.city) return false;
    if (filters.trade && filters.trade !== "all" && signal.primaryTrade !== filters.trade && !signal.adjacentTrades.includes(filters.trade)) return false;
    if (signal.score < minScore) return false;
    if (signal.ageHours != null && signal.ageHours > maxAge) return false;
    return true;
  }).slice(0, limit);
  return {
    ok: scan.health.some(row => row.ok),
    generatedAt: new Date().toISOString(),
    filters: { city: filters.city || "all", trade: filters.trade || "all", minScore, maxAgeHours: maxAge, limit },
    count: signals.length,
    signals,
    sourceHealth: scan.health,
    attribution: "Public-record intelligence derived from cited municipal sources. PermitRail is independent and is not affiliated with the source jurisdictions.",
  };
}

async function scheduleRefresh(origin: string, slot: number) {
  const callback = `${origin.replace(/\/$/, "")}/api/permitrail/refresh?slot=${slot}&token=${encodeURIComponent(tokenForSlot(slot))}`;
  const delay = Math.max(60, slot - Math.floor(Date.now() / 1000));
  const r = await fetch(SCHEDULER, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ url: callback, delay_seconds: delay, payload: {} }), cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`PermitRail scheduler HTTP ${r.status}: ${raw.slice(0, 220)}`);
  return { ok: true, slot, delaySeconds: delay };
}

export async function runPermitRailRefresh(publicOrigin: string) {
  const existing = await loadPermitRailState();
  const state = existing || blank();
  try {
    const feed = await buildPermitRailFeed({ minScore: 0, maxAgeHours: 90 * 24, limit: 500 });
    const cityCounts = byCount(feed.signals, s => s.city);
    const tradeCounts = byCount(feed.signals, s => s.primaryTrade);
    state.lastRefreshAt = feed.generatedAt;
    state.refreshCount += 1;
    state.totalSignals = feed.signals.length;
    state.hotSignals = feed.signals.filter(s => s.urgency === "hot").length;
    state.warmSignals = feed.signals.filter(s => s.urgency === "warm").length;
    state.sourceHealth = feed.sourceHealth;
    state.cities = cityCounts.map(row => ({ city: row.key, count: row.count, hot: row.hot }));
    state.trades = tradeCounts.map(row => ({ trade: row.key, count: row.count, hot: row.hot }));
    state.top = feed.signals.slice(0, 8).map(s => ({ id: s.id, city: s.city, primaryTrade: s.primaryTrade, score: s.score, estimatedOpportunityValueUsd: s.estimatedOpportunityValueUsd, ageHours: s.ageHours }));
  } catch (error) {
    state.errors = [`${new Date().toISOString()} ${error instanceof Error ? error.message : String(error)}`, ...state.errors].slice(0, 5);
  }

  const nextSlot = Math.floor(Date.now() / 1000) + REFRESH_SECONDS;
  state.nextRefreshAt = new Date(nextSlot * 1000).toISOString();
  try {
    await scheduleRefresh(publicOrigin, nextSlot);
    state.scheduler = { ok: true, lastScheduledAt: new Date().toISOString(), error: null };
  } catch (error) {
    state.scheduler = { ok: false, lastScheduledAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) };
  }
  try { await savePermitRailState(state); } catch (error) {
    state.errors = [`${new Date().toISOString()} ${error instanceof Error ? error.message : String(error)}`, ...state.errors].slice(0, 5);
  }
  return { ok: true, mode: "PERMITRAIL_REVENUE_ENGINE_V69", state };
}

export async function ensurePermitRailScheduled(publicOrigin: string) {
  const state = await loadPermitRailState();
  if (state?.scheduler?.ok && state.nextRefreshAt && Date.parse(state.nextRefreshAt) > Date.now() - 10 * 60_000) {
    return { ok: true, action: "ALREADY_RUNNING", state };
  }
  const slot = Math.floor(Date.now() / 1000) + 60;
  await scheduleRefresh(publicOrigin, slot);
  return { ok: true, action: "SCHEDULED", slot, state };
}

export async function updatePermitRailDistribution(partial: Partial<PermitRailState["distribution"]>) {
  const state = (await loadPermitRailState()) || blank();
  state.distribution = { ...state.distribution, ...partial, lastAttemptAt: new Date().toISOString() };
  await savePermitRailState(state);
  return state.distribution;
}
