import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { autopilotStatus } from "@/lib/autopilot";
import { scanExternalRevenue24h } from "@/lib/revenue-ledger";
import { gatefareRevenue, syncGatefareExistingProducts } from "@/lib/portfolio-distribution";
import { kalshiLiveConfig } from "@/lib/kalshi-live";
import {
  MOLTJOBS_TARGET_BUDGET_USDC,
  MOLTJOBS_TARGET_JOB_ID,
  MOLTJOBS_TARGET_TITLE,
  moltJobsNewSettledRevenue,
  moltJobsRevenue24h,
  runMoltJobsRevenueStrike,
  type MoltJobsState,
} from "@/lib/moltjobs";
import { agentTaskRowsSha256 } from "@/lib/revenue-strike-data";
import { polymarketUSConfig, scanPolymarketUSScaleOpportunity } from "@/lib/polymarket-us";
import { runMoneyFoundry } from "@/lib/scale-foundry";
import { BATCHRAIL_FULL_MAX_ITEMS, BATCHRAIL_FULL_PRICE_USD, batchRailEconomics } from "@/lib/batchrail";
import { batchRailActivationState } from "@/lib/batchrail-activation";

const NTFY = "https://ntfy.sh";
const SCHEDULER = "https://aisenseapi.com/services/v1/webhook_schedule";
const INTERVAL_SECONDS = 10 * 60;
const DAILY_SPEND_CAP = 1;
const WEEKLY_SPEND_CAP = 5;
const UNPROVEN_TEST_CAP = 0.05;

export type PortfolioExperiment = {
  id: string; lane: string; task: string; demandSource: string; buyerPriceUsd: number | null;
  upstreamCostUsd: number; platformFeesUsd: number; expectedMarginUsd: number | null;
  actualSpendUsd: number; actualRevenueUsd: number; actualNetUsd: number; outsidePayers: number;
  repeats: number; status: "observed" | "shadow-test" | "live" | "scale" | "background" | "killed" | "blocked";
  lastAction: string; nextAction: string;
};

type Spend = { at: string; usd: number; kind: "experiment" | "fulfillment"; experimentId: string };
type SeenRevenue = { key: string; usd: number; payer: string | null };

type ScaleState = {
  checkedAt: string | null;
  samples: number;
  capacityHitSamples: number;
  polymarket: {
    ok: boolean; activeMarkets: number; activePeriods: number; totalDailyizedRewardPoolUsd: number;
    marketsAtLeast1000: number; marketsAtLeast5000: number; largestDailyizedPoolUsd: number;
    top: Array<{ marketSlug: string; programType: string; dailyPoolUsd: number; targetSize: number | null; capitalUsd: number | null; bestBid: number | null; bestAsk: number | null; midpoint: number | null; visibleGrossUpperUsdPerDay: number | null; poolToCapital: number | null }>;
    live: boolean; configured: boolean; armed: boolean; maxCapitalUsd: number; error: string | null;
  };
  paper: {
    startedAt: string; sameMarketMoveSamples: number; midpointAbsMoveSum: number; visibleGrossUpperSum: number; capitalSum: number;
    avgMidpointAbsMove: number | null; avgVisibleGrossUpperUsdPerDay: number | null; avgIndicativeCapitalUsd: number | null;
    screenPassed: boolean; liveCapitalReady: boolean; reason: string;
    previousMarketSlug: string | null; previousMidpoint: number | null;
  };
  foundry: { primary: string; x402Services: number; x402Samples24h: number; medianPriceUsd: number | null; lanes: Array<{ id: string; status: string; measuredDemand: string }>; error: string | null };
};

type MoneyState = {
  actualOutside24hUsd: number; actualKnownCost24hUsd: number; actualNet24hUsd: number;
  allTimeOutsideUsd: number; allTimeKnownCostUsd: number; allTimeNetUsd: number;
  outsidePayers24h: number; outsidePayments24h: number; firstDollarAt: string | null;
  firstDollarSource: string | null; progressTo1000Day: number;
  x402Outside24hUsd: number; moltJobsOutside24hUsd: number;
  x402Payers24h: number; x402Payments24h: number;
};

export type PortfolioState = {
  v: 67; startedAt: string; lastTickAt: string | null; lastSlot: number; nextSlot: number | null; tickCount: number;
  scheduler: { ok: boolean; lastScheduledAt: string | null; lastError: string | null };
  money: MoneyState;
  budget: { dailyCapUsd: number; weeklyCapUsd: number; unprovenTestCapUsd: number; spentTodayUsd: number; spentWeekUsd: number; availableTodayUsd: number; availableWeekUsd: number; spend: Spend[] };
  demand: { checkedAt: string | null; baseBountyOpenApprox: number; baseBountyExamples: string[]; taskBountyOpen: number | null; taskBountyTop: Array<{ id: string; title: string; rewardUsd: number }>; radarPrimary: string | null; error: string | null };
  distribution: { gatefareConfigured: boolean; gatefareProducts: number; gatefareRevenueUsd: number; gatefarePublishedThisRun: number; agent402Healthy: boolean | null; lastAction: string; error: string | null };
  moltJobs: MoltJobsState;
  scale: ScaleState;
  kalshiLive: { live: boolean; configured: boolean; armed: boolean; killSwitch: boolean; maxCapitalUsd: number };
  experiments: PortfolioExperiment[]; seenRevenue: SeenRevenue[]; errors: string[];
};

function secret() { return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || ""; }
function origin() { const e = process.env.PENNYRAIL_PUBLIC_URL?.trim(); if (e) return e.replace(/\/$/, ""); const p = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim(); return p ? `https://${p.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "https://pennyrail.vercel.app"; }
function safeEqual(a: string, b: string) { try { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); } catch { return false; } }
// Keep the v65 topic/token/signature namespace so the live callback chain and
// persistent economic history survive the v66 Revenue Strike deployment.
function topic() { if (!secret()) throw new Error("portfolio state secret unavailable"); return `pennyrail-${createHash("sha256").update(`portfolio-v65:${secret()}`).digest("hex").slice(0, 40)}`; }
function tokenForSlot(slot: number) { return createHmac("sha256", secret()).update(`portfolio-v65:${slot}`).digest("hex"); }
export function verifyPortfolioToken(slot: number, token: string) { return Number.isInteger(slot) && slot > 0 && Boolean(token) && Boolean(secret()) && safeEqual(token, tokenForSlot(slot)); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round(v: number, d = 6) { return Number(v.toFixed(d)); }
function nowIso() { return new Date().toISOString(); }

function blankMoltJobs(): MoltJobsState {
  return {
    configured: Boolean(process.env.MOLTJOBS_API_KEY?.trim()), checkedAt: null, agentId: null,
    openJobs: 0, targetOpen: false, targetJobStatus: null, bidId: null, bidStatus: null,
    deliverableUrl: `${origin()}/api/revenue-deliverables/moltjobs-agent-tasks`, proofHash: agentTaskRowsSha256(),
    walletAddress: null, walletBalanceUsd: 0, settledRevenueUsd: 0, payouts: [], submittedAt: null,
    lastAction: "Revenue Strike waiting for MoltJobs credential.",
    nextAction: "Configure MOLTJOBS_API_KEY to bid on the live 5 USDC target.", error: null,
  };
}

function blankScale(): ScaleState {
  const p = polymarketUSConfig();
  return {
    checkedAt: null, samples: 0, capacityHitSamples: 0,
    polymarket: { ok: false, activeMarkets: 0, activePeriods: 0, totalDailyizedRewardPoolUsd: 0, marketsAtLeast1000: 0, marketsAtLeast5000: 0, largestDailyizedPoolUsd: 0, top: [], live: p.live, configured: p.configured, armed: p.armed, maxCapitalUsd: p.maxCapitalUsd, error: null },
    paper: { startedAt: nowIso(), sameMarketMoveSamples: 0, midpointAbsMoveSum: 0, visibleGrossUpperSum: 0, capitalSum: 0, avgMidpointAbsMove: null, avgVisibleGrossUpperUsdPerDay: null, avgIndicativeCapitalUsd: null, screenPassed: false, liveCapitalReady: false, reason: "Scale Gate is starting public Polymarket US incentive observations. No capital is authorized.", previousMarketSlug: null, previousMidpoint: null },
    foundry: { primary: "starting", x402Services: 0, x402Samples24h: 0, medianPriceUsd: null, lanes: [], error: null },
  };
}

function blank(): PortfolioState {
  const k = kalshiLiveConfig();
  return {
    v: 67, startedAt: nowIso(), lastTickAt: null, lastSlot: 0, nextSlot: null, tickCount: 0,
    scheduler: { ok: false, lastScheduledAt: null, lastError: null },
    money: { actualOutside24hUsd: 0, actualKnownCost24hUsd: 0, actualNet24hUsd: 0, allTimeOutsideUsd: 0, allTimeKnownCostUsd: 0, allTimeNetUsd: 0, outsidePayers24h: 0, outsidePayments24h: 0, firstDollarAt: null, firstDollarSource: null, progressTo1000Day: 0, x402Outside24hUsd: 0, moltJobsOutside24hUsd: 0, x402Payers24h: 0, x402Payments24h: 0 },
    budget: { dailyCapUsd: DAILY_SPEND_CAP, weeklyCapUsd: WEEKLY_SPEND_CAP, unprovenTestCapUsd: UNPROVEN_TEST_CAP, spentTodayUsd: 0, spentWeekUsd: 0, availableTodayUsd: DAILY_SPEND_CAP, availableWeekUsd: WEEKLY_SPEND_CAP, spend: [] },
    demand: { checkedAt: null, baseBountyOpenApprox: 0, baseBountyExamples: [], taskBountyOpen: null, taskBountyTop: [], radarPrimary: null, error: null },
    distribution: { gatefareConfigured: Boolean(process.env.GATEFARE_PAT?.trim()), gatefareProducts: 0, gatefareRevenueUsd: 0, gatefarePublishedThisRun: 0, agent402Healthy: null, lastAction: "Existing x402 distribution remains live; dead/unavailable storefronts are not a setup priority.", error: null },
    moltJobs: blankMoltJobs(),
    scale: blankScale(),
    kalshiLive: { live: k.live, configured: k.configured, armed: k.armed, killSwitch: k.killSwitch, maxCapitalUsd: k.maxCapitalUsd },
    experiments: [], seenRevenue: [], errors: [],
  };
}

function migrateState(raw: any): PortfolioState {
  const base = blank();
  const state: PortfolioState = {
    ...base, ...raw, v: 67,
    scheduler: { ...base.scheduler, ...(raw?.scheduler || {}) },
    money: { ...base.money, ...(raw?.money || {}) },
    budget: { ...base.budget, ...(raw?.budget || {}), spend: Array.isArray(raw?.budget?.spend) ? raw.budget.spend : [] },
    demand: { ...base.demand, ...(raw?.demand || {}), baseBountyExamples: Array.isArray(raw?.demand?.baseBountyExamples) ? raw.demand.baseBountyExamples : [], taskBountyTop: Array.isArray(raw?.demand?.taskBountyTop) ? raw.demand.taskBountyTop : [] },
    distribution: { ...base.distribution, ...(raw?.distribution || {}) },
    moltJobs: { ...base.moltJobs, ...(raw?.moltJobs || {}), payouts: Array.isArray(raw?.moltJobs?.payouts) ? raw.moltJobs.payouts : [] },
    scale: { ...base.scale, ...(raw?.scale || {}), polymarket: { ...base.scale.polymarket, ...(raw?.scale?.polymarket || {}), top: Array.isArray(raw?.scale?.polymarket?.top) ? raw.scale.polymarket.top : [] }, paper: { ...base.scale.paper, ...(raw?.scale?.paper || {}) }, foundry: { ...base.scale.foundry, ...(raw?.scale?.foundry || {}), lanes: Array.isArray(raw?.scale?.foundry?.lanes) ? raw.scale.foundry.lanes : [] } },
    kalshiLive: { ...base.kalshiLive, ...(raw?.kalshiLive || {}) },
    experiments: Array.isArray(raw?.experiments) ? raw.experiments : [],
    seenRevenue: Array.isArray(raw?.seenRevenue) ? raw.seenRevenue : [],
    errors: Array.isArray(raw?.errors) ? raw.errors : [],
  };
  return state;
}

function encode(state: PortfolioState) {
  const body = deflateRawSync(Buffer.from(JSON.stringify(state)), { level: 9 }).toString("base64");
  const sig = createHmac("sha256", secret()).update(`portfolio-state-v65:${body}`).digest("hex").slice(0, 40);
  return `${body}.${sig}`;
}
function decode(raw: string): PortfolioState | null {
  try {
    const i = raw.lastIndexOf("."); if (i < 1) return null;
    const body = raw.slice(0, i), sig = raw.slice(i + 1);
    const exp = createHmac("sha256", secret()).update(`portfolio-state-v65:${body}`).digest("hex").slice(0, 40);
    if (!safeEqual(sig, exp)) return null;
    const parsed = JSON.parse(inflateRawSync(Buffer.from(body, "base64")).toString("utf8"));
    return parsed?.v === 65 || parsed?.v === 66 || parsed?.v === 67 ? migrateState(parsed) : null;
  } catch { return null; }
}

async function latestNtfyMessage(topicName: string) {
  const r = await fetch(`${NTFY}/${encodeURIComponent(topicName)}/json?poll=1&since=latest`, { headers: { accept: "application/x-ndjson,application/json" }, cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!r.ok) return null;
  const rows = (await r.text()).split(/\r?\n/).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(x => x?.event === "message" && typeof x?.message === "string");
  return rows.length ? String(rows[rows.length - 1].message) : null;
}

function chunkTopic(index: number) { return `${topic()}-state-${index}`; }

export async function loadPortfolioState() {
  try {
    const raw = await latestNtfyMessage(topic());
    if (!raw) return null;
    const manifest = raw.match(/^chunks:([0-9a-f]{12}):(\d+)$/);
    if (!manifest) return decode(raw);
    const id = manifest[1];
    const count = Math.max(0, Math.min(4, Number(manifest[2])));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, async (_, index) => {
      const partRaw = await latestNtfyMessage(chunkTopic(index));
      if (!partRaw) return null;
      try {
        const row = JSON.parse(partRaw);
        return row?.v === 1 && row?.id === id && row?.i === index && row?.n === count && typeof row?.data === "string" ? row.data : null;
      } catch { return null; }
    }));
    if (parts.some(part => part == null)) return null;
    return decode(parts.join(""));
  } catch { return null; }
}

function compactText(value: unknown, max: number) {
  const s = String(value ?? "");
  return s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`;
}

function compactForPersistence(state: PortfolioState, aggressive = false): PortfolioState {
  // ntfy is only the durable checkpoint, not the dashboard payload. Keep the
  // economic/accounting aggregates intact and trim verbose/reconstructable text.
  const saved = JSON.parse(JSON.stringify(state)) as PortfolioState;
  saved.seenRevenue = saved.seenRevenue.slice(aggressive ? -20 : -50);
  saved.errors = saved.errors.slice(0, aggressive ? 2 : 4).map(x => compactText(x, 220));
  saved.budget.spend = saved.budget.spend.slice(aggressive ? -16 : -28);
  saved.moltJobs.payouts = saved.moltJobs.payouts.slice(aggressive ? -4 : -8);
  saved.demand.baseBountyExamples = saved.demand.baseBountyExamples.slice(0, aggressive ? 1 : 2).map(x => compactText(x, 100));
  saved.demand.taskBountyTop = saved.demand.taskBountyTop.slice(0, aggressive ? 1 : 2);
  saved.scale.polymarket.top = saved.scale.polymarket.top.slice(0, aggressive ? 1 : 2);
  saved.scale.foundry.lanes = saved.scale.foundry.lanes.slice(0, aggressive ? 1 : 2).map(row => ({
    ...row,
    measuredDemand: compactText(row.measuredDemand, aggressive ? 100 : 160),
  }));
  saved.experiments = saved.experiments.slice(0, aggressive ? 5 : 8).map(row => ({
    ...row,
    task: compactText(row.task, aggressive ? 90 : 140),
    demandSource: compactText(row.demandSource, aggressive ? 80 : 120),
    lastAction: compactText(row.lastAction, aggressive ? 110 : 180),
    nextAction: compactText(row.nextAction, aggressive ? 110 : 180),
  }));
  saved.distribution.lastAction = compactText(saved.distribution.lastAction, aggressive ? 120 : 180);
  if (saved.distribution.error) saved.distribution.error = compactText(saved.distribution.error, 180);
  if (saved.demand.error) saved.demand.error = compactText(saved.demand.error, 180);
  if (saved.moltJobs.error) saved.moltJobs.error = compactText(saved.moltJobs.error, aggressive ? 160 : 220);
  saved.moltJobs.lastAction = compactText(saved.moltJobs.lastAction, aggressive ? 120 : 180);
  saved.moltJobs.nextAction = compactText(saved.moltJobs.nextAction, aggressive ? 120 : 180);
  saved.scale.paper.reason = compactText(saved.scale.paper.reason, aggressive ? 140 : 220);
  if (saved.scale.polymarket.error) saved.scale.polymarket.error = compactText(saved.scale.polymarket.error, 180);
  if (saved.scale.foundry.error) saved.scale.foundry.error = compactText(saved.scale.foundry.error, 180);
  return saved;
}

async function writeNtfy(topicName: string, title: string, message: string) {
  const r = await fetch(`${NTFY}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: topicName, title, message, priority: 1 }), cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`ntfy portfolio write HTTP ${r.status}`);
}

async function save(state: PortfolioState) {
  // Never mutate the live state just to fit the persistence transport.
  let persisted = compactForPersistence(state, false);
  let message = encode(persisted);
  if (message.length > 3900) {
    persisted = compactForPersistence(state, true);
    message = encode(persisted);
  }
  if (message.length <= 3900) {
    await writeNtfy(topic(), "PennyRail portfolio v67 Scale Gate + BatchRail", message);
    return;
  }

  // ntfy messages cap out around 4KB. Large but valid economic states are split
  // across deterministic private topics, then the main topic stores a tiny manifest.
  const chunkSize = 3000;
  const parts = Array.from({ length: Math.ceil(message.length / chunkSize) }, (_, index) => message.slice(index * chunkSize, (index + 1) * chunkSize));
  if (parts.length > 4) throw new Error(`portfolio state exceeded four-part ntfy checkpoint capacity (${message.length})`);
  const id = createHash("sha256").update(message).digest("hex").slice(0, 12);
  for (let index = 0; index < parts.length; index += 1) {
    await writeNtfy(chunkTopic(index), "PennyRail portfolio state chunk", JSON.stringify({ v: 1, id, i: index, n: parts.length, data: parts[index] }));
  }
  await writeNtfy(topic(), "PennyRail portfolio v67 Scale Gate + BatchRail", `chunks:${id}:${parts.length}`);
}

function updateBudget(state: PortfolioState) {
  const now = Date.now(); const day = now - 86400000; const week = now - 7 * 86400000;
  state.budget.spend = state.budget.spend.filter(s => Date.parse(s.at) >= week);
  state.budget.spentTodayUsd = round(state.budget.spend.filter(s => Date.parse(s.at) >= day).reduce((a, s) => a + s.usd, 0));
  state.budget.spentWeekUsd = round(state.budget.spend.reduce((a, s) => a + s.usd, 0));
  state.budget.availableTodayUsd = round(Math.max(0, DAILY_SPEND_CAP - state.budget.spentTodayUsd));
  state.budget.availableWeekUsd = round(Math.max(0, WEEKLY_SPEND_CAP - state.budget.spentWeekUsd));
}

export function approveExperimentalSpend(state: PortfolioState, experimentId: string, usd: number, proven = false) {
  updateBudget(state); const amount = round(Math.max(0, usd));
  if (!(amount > 0)) return { ok: false, reason: "spend must be positive" };
  if (!proven && amount > UNPROVEN_TEST_CAP + 1e-9) return { ok: false, reason: `unproven test cap is $${UNPROVEN_TEST_CAP}` };
  if (amount > state.budget.availableTodayUsd + 1e-9) return { ok: false, reason: "daily experiment cap exceeded" };
  if (amount > state.budget.availableWeekUsd + 1e-9) return { ok: false, reason: "weekly experiment cap exceeded" };
  state.budget.spend.push({ at: nowIso(), usd: amount, kind: "experiment", experimentId }); updateBudget(state); return { ok: true };
}

async function scanBaseBounty() {
  const r = await fetch("https://basebounty.app/", { headers: { accept: "text/html", "user-agent": "PennyRail-Portfolio/1.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`BaseBounty HTTP ${r.status}`); const html = await r.text();
  const rewards = [...html.matchAll(/\$(\d+(?:\.\d{1,2})?)/g)].map(m => Number(m[1])).filter(n => n > 0 && n < 100000);
  const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ");
  const examples = ["TypeScript snippet", "Scrape & dedupe", "Design a Twitter/X banner"].filter(x => cleaned.toLowerCase().includes(x.toLowerCase()));
  return { approximateOpen: Math.min(50, rewards.length), examples: examples.slice(0, 3) };
}

async function scanTaskBounty() {
  const headers: Record<string, string> = { accept: "application/json", "user-agent": "PennyRail-Portfolio/1.0" };
  if (process.env.TASKBOUNTY_API_KEY?.trim()) headers.authorization = `Bearer ${process.env.TASKBOUNTY_API_KEY.trim()}`;
  const r = await fetch("https://www.task-bounty.com/api/v1/tasks?state=open&limit=20", { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`TaskBounty HTTP ${r.status}`); const body = await r.json(); const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
  return { count: tasks.length, top: tasks.map((t: any) => ({ id: String(t?.id || ""), title: String(t?.title || t?.github_issue_title || "Untitled").slice(0, 120), rewardUsd: round(num(t?.bounty_cents ?? t?.reward_cents) / 100, 2) })).sort((a: any, b: any) => b.rewardUsd - a.rewardUsd).slice(0, 5) };
}

function upsert(state: PortfolioState, exp: PortfolioExperiment) {
  const i = state.experiments.findIndex(e => e.id === exp.id); if (i >= 0) state.experiments[i] = { ...state.experiments[i], ...exp }; else state.experiments.unshift(exp);
}

function recomputeMoney(state: PortfolioState) {
  updateBudget(state);
  const since = Date.now() - 86400000;
  state.money.moltJobsOutside24hUsd = moltJobsRevenue24h(state.moltJobs);
  state.money.actualOutside24hUsd = round(state.money.x402Outside24hUsd + state.money.moltJobsOutside24hUsd);
  const moltPayoutCount = (state.moltJobs.payouts || []).filter(row => Date.parse(row.at) >= Date.now() - 86400000).length;
  state.money.outsidePayers24h = state.money.x402Payers24h + (state.money.moltJobsOutside24hUsd > 0 ? 1 : 0);
  state.money.outsidePayments24h = state.money.x402Payments24h + moltPayoutCount;
  state.money.actualKnownCost24hUsd = round(state.budget.spend.filter(s => Date.parse(s.at) >= since).reduce((a, s) => a + s.usd, 0));
  state.money.allTimeKnownCostUsd = round(state.budget.spend.reduce((a, s) => a + s.usd, 0));
  state.money.actualNet24hUsd = round(state.money.actualOutside24hUsd - state.money.actualKnownCost24hUsd);
  state.money.allTimeNetUsd = round(state.money.allTimeOutsideUsd - state.money.allTimeKnownCostUsd);
  state.money.progressTo1000Day = round(Math.max(0, state.money.actualNet24hUsd) / 1000, 4);
}

function ingestChainRevenue(state: PortfolioState, ledger: any) {
  const transfers = Array.isArray(ledger?.external?.transfers) ? ledger.external.transfers : [];
  for (const t of transfers) {
    const key = `${t?.txHash || ""}:${t?.logIndex || ""}`; const usd = Math.max(0, num(t?.amountUsd)); if (!key || !usd || state.seenRevenue.some(x => x.key === key)) continue;
    state.seenRevenue.push({ key, usd, payer: t?.sender ? String(t.sender) : null }); state.money.allTimeOutsideUsd = round(state.money.allTimeOutsideUsd + usd);
    if (!state.money.firstDollarAt) { state.money.firstDollarAt = nowIso(); state.money.firstDollarSource = "outside Base USDC to PennyRail seller wallet"; }
  }
  state.money.x402Outside24hUsd = round(num(ledger?.external?.usdcUsd));
  state.money.x402Payers24h = num(ledger?.external?.uniquePayers);
  state.money.x402Payments24h = num(ledger?.external?.transferCount);
  recomputeMoney(state);
}

async function reconcileBatchRailSeedSpend(state: PortfolioState) {
  try {
    const seed = await batchRailActivationState();
    if (seed?.status !== "seeded") return;
    if (state.budget.spend.some(row => row.experimentId === "batchrail-bazaar-seed")) return;
    state.budget.spend.push({ at: seed.at, usd: 0.05, kind: "experiment", experimentId: "batchrail-bazaar-seed" });
    updateBudget(state);
  } catch {}
}

async function runMoltJobs(state: PortfolioState) {
  const before = state.moltJobs;
  const after = await runMoltJobsRevenueStrike(origin(), before);
  const newRevenue = moltJobsNewSettledRevenue(before, after);
  state.moltJobs = after;
  if (newRevenue > 0) {
    state.money.allTimeOutsideUsd = round(state.money.allTimeOutsideUsd + newRevenue);
    if (!state.money.firstDollarAt) {
      state.money.firstDollarAt = nowIso();
      state.money.firstDollarSource = `MoltJobs settled USDC payout for ${MOLTJOBS_TARGET_JOB_ID}`;
    }
  }
  recomputeMoney(state);
}


async function runScaleGate(state: PortfolioState) {
  const scan = await scanPolymarketUSScaleOpportunity();
  const foundry = await runMoneyFoundry(scan);
  const previous = state.scale.paper;
  const best = scan.top[0] || null;
  state.scale.checkedAt = nowIso();
  state.scale.samples += 1;
  if (scan.marketsWithAtLeast1000DailyPool > 0) state.scale.capacityHitSamples += 1;
  const cfg = scan.liveCapability;
  state.scale.polymarket = {
    ok: scan.ok, activeMarkets: scan.activeMarkets, activePeriods: scan.activePeriods,
    totalDailyizedRewardPoolUsd: scan.totalDailyizedRewardPoolUsd, marketsAtLeast1000: scan.marketsWithAtLeast1000DailyPool,
    marketsAtLeast5000: scan.marketsWithAtLeast5000DailyPool, largestDailyizedPoolUsd: scan.largestDailyizedPoolUsd,
    top: scan.top.slice(0, 3).map(row => ({ marketSlug: row.marketSlug, programType: row.programType, dailyPoolUsd: row.dailyizedRewardPoolUsd, targetSize: row.targetSizeContracts, capitalUsd: row.indicativeFullTargetCapitalUsd, bestBid: row.bestBid, bestAsk: row.bestAsk, midpoint: row.midpoint, visibleGrossUpperUsdPerDay: row.visibleBookGrossRewardUpperUsdPerDay, poolToCapital: row.poolToTargetCapitalRatio })),
    live: cfg.live, configured: cfg.configured, armed: cfg.armed, maxCapitalUsd: cfg.maxCapitalUsd, error: scan.error,
  };

  if (best) {
    if (previous.previousMarketSlug === best.marketSlug && previous.previousMidpoint != null && best.midpoint != null) {
      previous.sameMarketMoveSamples += 1;
      previous.midpointAbsMoveSum += Math.abs(best.midpoint - previous.previousMidpoint);
    }
    if (best.visibleBookGrossRewardUpperUsdPerDay != null) previous.visibleGrossUpperSum += Math.max(0, best.visibleBookGrossRewardUpperUsdPerDay);
    if (best.indicativeFullTargetCapitalUsd != null) previous.capitalSum += Math.max(0, best.indicativeFullTargetCapitalUsd);
    previous.previousMarketSlug = best.marketSlug;
    previous.previousMidpoint = best.midpoint;
  }
  previous.avgMidpointAbsMove = previous.sameMarketMoveSamples ? round(previous.midpointAbsMoveSum / previous.sameMarketMoveSamples, 6) : null;
  previous.avgVisibleGrossUpperUsdPerDay = state.scale.samples ? round(previous.visibleGrossUpperSum / state.scale.samples, 2) : null;
  previous.avgIndicativeCapitalUsd = state.scale.samples ? round(previous.capitalSum / state.scale.samples, 2) : null;
  const capacityConsistency = state.scale.samples > 0 ? state.scale.capacityHitSamples / state.scale.samples : 0;
  previous.screenPassed = state.scale.samples >= 3 && capacityConsistency >= 0.67 && num(previous.avgVisibleGrossUpperUsdPerDay) >= 1_000;
  // Public books cannot reveal our future fills/adverse selection. Passing this screen
  // earns an account/credential setup recommendation, never automatic capital authorization.
  previous.liveCapitalReady = false;
  previous.reason = !scan.ok
    ? `Polymarket public scan failed: ${scan.error || "unknown error"}`
    : !scan.marketsWithAtLeast1000DailyPool
      ? "Current active incentive inventory does not clear the $1,000/day capacity gate."
      : !previous.screenPassed
        ? `External reward capacity clears $1K/day; PennyRail is accumulating repeated competition/capital observations (${state.scale.samples} samples).`
        : "Scale screen passed on repeated public observations. Code is live-capable but capital remains disabled until account verification, credentials, an explicit capital cap, and human authorization.";

  state.scale.foundry = {
    primary: foundry.primary, x402Services: foundry.x402.servicesObserved, x402Samples24h: foundry.x402.samples24h, medianPriceUsd: foundry.x402.medianObservedPriceUsd,
    lanes: foundry.lanes.slice(0, 3).map(row => ({ id: row.id, status: row.status, measuredDemand: row.measuredDemand })), error: foundry.error,
  };

  upsert(state, {
    id: "polymarket-us-scale", lane: "external incentive pools", task: "Harvest exchange-paid liquidity/volume/fill incentives only when measured net economics clear the $1K/day gate",
    demandSource: "Polymarket US official active incentive programs", buyerPriceUsd: null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: null, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: state.scale.samples,
    status: scan.marketsWithAtLeast1000DailyPool > 0 ? "shadow-test" : "observed",
    lastAction: `${scan.marketsWithAtLeast1000DailyPool} active reward periods currently have >=$1K/day pool capacity; largest dailyized pool ${moneyText(scan.largestDailyizedPoolUsd)}.`,
    nextAction: previous.screenPassed ? "Scale screen passed; prepare account/KYC/API setup without funding until capital authorization." : "Keep paper-scanning reward pools, visible competition and capital efficiency every 10 minutes.",
  });
  const batchEconomics = batchRailEconomics();
  const batchFloor = Math.max(0, num(batchEconomics.full.minimumGuardedContributionUsd));
  const requiredBatches = Math.ceil(1000 / Math.max(0.000001, batchFloor));
  upsert(state, {
    id: "batchrail-bulk-inference", lane: "machine-commerce tollbooth", task: "Batch hundreds of short AI classification decisions behind one x402 settlement to undercut per-request payment overhead",
    demandSource: "Existing high-volume paid AI gateway traffic + x402/Bazaar discovery", buyerPriceUsd: BATCHRAIL_FULL_PRICE_USD, upstreamCostUsd: batchEconomics.maxGuardedUpstreamUsd, platformFeesUsd: 0, expectedMarginUsd: batchFloor, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: 0, status: "live",
    lastAction: `Live paid BatchRail route: up to ${BATCHRAIL_FULL_MAX_ITEMS.toLocaleString()} items for $${BATCHRAIL_FULL_PRICE_USD.toFixed(2)}; guarded minimum contribution $${batchFloor.toFixed(3)} per full batch.`,
    nextAction: `Distribution is active; demand must prove ${requiredBatches.toLocaleString()} full batches/day or a higher-value expansion before this lane alone reaches the $1K/day floor.`
  });
  upsert(state, {
    id: "money-foundry", lane: "new product foundry", task: "Create or route only products/platforms with a credible $1K+/day ceiling",
    demandSource: "402radar + direct market evidence + public unmet-need research", buyerPriceUsd: null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: null, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: state.scale.samples, status: "live",
    lastAction: `Primary scale lane: ${foundry.primary}. 402 scan observed ${foundry.x402.servicesObserved} services / ${foundry.x402.samples24h.toLocaleString()} 24h samples.`,
    nextAction: "Reject low-ceiling chores; build transaction tollbooths or high-ticket products from measured gaps while external-pool lanes paper-test.",
  });
}

function moneyText(value: unknown) { return `$${num(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }

async function heavy(state: PortfolioState) {
  const [ledgerR, autopilotR, baseR, taskR, gfSyncR, gfRevenueR] = await Promise.allSettled([
    scanExternalRevenue24h(), autopilotStatus(), scanBaseBounty(), scanTaskBounty(), syncGatefareExistingProducts(3), gatefareRevenue(30),
  ]);
  if (ledgerR.status === "fulfilled") ingestChainRevenue(state, ledgerR.value); else state.errors.unshift(`ledger: ${String(ledgerR.reason)}`);
  if (autopilotR.status === "fulfilled") {
    const a: any = autopilotR.value;
    state.demand.radarPrimary = a?.state?.radar?.primary ?? a?.radar?.primary ?? null;
    const hunterOk = a?.state?.radar?.x402HunterOk ?? a?.radar?.x402HunterOk;
    state.distribution.agent402Healthy = hunterOk == null ? null : Boolean(hunterOk);
  }
  state.demand.checkedAt = nowIso();
  if (baseR.status === "fulfilled") { state.demand.baseBountyOpenApprox = baseR.value.approximateOpen; state.demand.baseBountyExamples = baseR.value.examples; } else state.demand.error = `BaseBounty: ${String(baseR.reason)}`;
  if (taskR.status === "fulfilled") { state.demand.taskBountyOpen = taskR.value.count; state.demand.taskBountyTop = taskR.value.top; } else state.demand.error = `${state.demand.error ? state.demand.error + "; " : ""}TaskBounty: ${String(taskR.reason)}`;
  if (gfSyncR.status === "fulfilled") {
    const g: any = gfSyncR.value; state.distribution.gatefareConfigured = Boolean(g.configured); state.distribution.gatefarePublishedThisRun = num(g.published); state.distribution.error = g.errors?.length ? g.errors.join("; ") : null;
  }
  if (gfRevenueR.status === "fulfilled") { const g: any = gfRevenueR.value; state.distribution.gatefareProducts = num(g.products); state.distribution.gatefareRevenueUsd = num(g.revenueUsd); }
  state.distribution.lastAction = "Existing x402/Agent402/Bazaar distribution remains live. Gatefare is dormant while its site is unavailable; no user setup is requested.";

  upsert(state, { id: "moltjobs-live-5usdc", lane: "funded agent work", task: MOLTJOBS_TARGET_TITLE, demandSource: "MoltJobs protected on-chain USDC escrow", buyerPriceUsd: MOLTJOBS_TARGET_BUDGET_USDC, upstreamCostUsd: 0, platformFeesUsd: 0.25, expectedMarginUsd: 4.75, actualSpendUsd: 0, actualRevenueUsd: state.moltJobs.settledRevenueUsd, actualNetUsd: state.moltJobs.settledRevenueUsd, outsidePayers: state.moltJobs.settledRevenueUsd > 0 ? 1 : 0, repeats: state.moltJobs.payouts.length, status: "background", lastAction: state.moltJobs.lastAction, nextAction: state.moltJobs.nextAction });
  upsert(state, { id: "existing-paid-distribution", lane: "multi-market distribution", task: "Keep existing paid PennyRail capabilities exposed on live x402 discovery surfaces", demandSource: "Agent402/Bazaar/x402", buyerPriceUsd: null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: null, actualSpendUsd: 0, actualRevenueUsd: state.money.x402Outside24hUsd, actualNetUsd: state.money.x402Outside24hUsd, outsidePayers: state.money.outsidePayers24h, repeats: state.money.outsidePayments24h, status: state.money.x402Outside24hUsd > 0 ? "scale" : "live", lastAction: state.distribution.lastAction, nextAction: "Keep measuring actual outside settlements; only promote this lane if measured demand proves a $1K+/day ceiling." });
  const topJob = state.demand.taskBountyTop[0];
  upsert(state, { id: "other-funded-agent-jobs", lane: "agent jobs/bounties", task: "Keep TaskBounty/BaseBounty listeners active for additional funded work", demandSource: "TaskBounty + BaseBounty", buyerPriceUsd: topJob?.rewardUsd ?? null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: topJob?.rewardUsd ?? null, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: 0, status: "background", lastAction: `Observed ${state.demand.taskBountyOpen ?? 0} TaskBounty jobs and ~${state.demand.baseBountyOpenApprox} BaseBounty reward markers.`, nextAction: "Claim only work with a reliable automated deliverable and verifiable positive expected net." });
  upsert(state, { id: "broker-spread", lane: "broker/reseller", task: "Use existing v36 broker supply only after paid demand arrives", demandSource: "Existing paid request + revenue engine", buyerPriceUsd: null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: null, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: 0, status: "live", lastAction: "Broker supply preserved; no speculative upstream purchase.", nextAction: "On buyer-authorized request, enforce known sale price, hard upstream max, and positive contribution margin." });
}

async function scheduleNext(slot: number, state: PortfolioState) {
  const delay = Math.max(60, Math.min(3600, slot - Math.floor(Date.now() / 1000)));
  const url = `${origin()}/api/portfolio/tick?slot=${slot}&token=${encodeURIComponent(tokenForSlot(slot))}`;
  const r = await fetch(SCHEDULER, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, delay_seconds: delay, payload: { state: encode(state) } }), cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`portfolio scheduler HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

export async function runPortfolioTick(slot = Math.floor(Date.now() / 1000), fallbackRaw?: string | null) {
  const persisted = await loadPortfolioState(); const fallback = fallbackRaw ? decode(fallbackRaw) : null;
  const state = persisted && fallback ? (persisted.lastSlot >= fallback.lastSlot ? persisted : fallback) : persisted || fallback || blank();
  if (state.lastSlot >= slot) return { ok: true, duplicate: true, state };

  // Reconcile the one-time BatchRail discovery seed into the experiment ledger
  // before recomputing NET. Internal wallet transfers remain excluded from revenue.
  await reconcileBatchRailSeedSpend(state);

  // Direct funded work gets checked every 10-minute tick rather than waiting for
  // the hourly heavy scan. A bid costs no cash under MoltJobs' free bid credits.
  try { await runMoltJobs(state); } catch (e) { state.errors.unshift(`MoltJobs: ${e instanceof Error ? e.message : String(e)}`); }
  try { await runScaleGate(state); } catch (e) { state.errors.unshift(`ScaleGate: ${e instanceof Error ? e.message : String(e)}`); }

  const shouldHeavy = state.tickCount === 0 || (state.tickCount + 1) % 6 === 0;
  if (shouldHeavy) { try { await heavy(state); } catch (e) { state.errors.unshift(e instanceof Error ? e.message : String(e)); } }
  const k = kalshiLiveConfig(); state.kalshiLive = { live: k.live, configured: k.configured, armed: k.armed, killSwitch: k.killSwitch, maxCapitalUsd: k.maxCapitalUsd };
  recomputeMoney(state); state.tickCount += 1; state.lastTickAt = nowIso(); state.lastSlot = slot;
  const nextSlot = Math.floor(Date.now() / 1000) + INTERVAL_SECONDS; state.nextSlot = nextSlot;
  try { await scheduleNext(nextSlot, state); state.scheduler = { ok: true, lastScheduledAt: nowIso(), lastError: null }; } catch (e) { state.scheduler = { ok: false, lastScheduledAt: state.scheduler.lastScheduledAt, lastError: e instanceof Error ? e.message : String(e) }; state.errors.unshift(state.scheduler.lastError || "scheduler failed"); }
  await save(state); return { ok: true, heavy: shouldHeavy, state };
}

export async function portfolioStatus() { const state = await loadPortfolioState(); return { ok: Boolean(state), state: state || blank() }; }
