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
  repeats: number; status: "observed" | "shadow-test" | "live" | "scale" | "killed" | "blocked";
  lastAction: string; nextAction: string;
};

type Spend = { at: string; usd: number; kind: "experiment" | "fulfillment"; experimentId: string };
type SeenRevenue = { key: string; usd: number; payer: string | null };

type MoneyState = {
  actualOutside24hUsd: number; actualKnownCost24hUsd: number; actualNet24hUsd: number;
  allTimeOutsideUsd: number; allTimeKnownCostUsd: number; allTimeNetUsd: number;
  outsidePayers24h: number; outsidePayments24h: number; firstDollarAt: string | null;
  firstDollarSource: string | null; progressTo1000Day: number;
  x402Outside24hUsd: number; moltJobsOutside24hUsd: number;
  x402Payers24h: number; x402Payments24h: number;
};

export type PortfolioState = {
  v: 66; startedAt: string; lastTickAt: string | null; lastSlot: number; nextSlot: number | null; tickCount: number;
  scheduler: { ok: boolean; lastScheduledAt: string | null; lastError: string | null };
  money: MoneyState;
  budget: { dailyCapUsd: number; weeklyCapUsd: number; unprovenTestCapUsd: number; spentTodayUsd: number; spentWeekUsd: number; availableTodayUsd: number; availableWeekUsd: number; spend: Spend[] };
  demand: { checkedAt: string | null; baseBountyOpenApprox: number; baseBountyExamples: string[]; taskBountyOpen: number | null; taskBountyTop: Array<{ id: string; title: string; rewardUsd: number }>; radarPrimary: string | null; error: string | null };
  distribution: { gatefareConfigured: boolean; gatefareProducts: number; gatefareRevenueUsd: number; gatefarePublishedThisRun: number; agent402Healthy: boolean | null; lastAction: string; error: string | null };
  moltJobs: MoltJobsState;
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

function blank(): PortfolioState {
  const k = kalshiLiveConfig();
  return {
    v: 66, startedAt: nowIso(), lastTickAt: null, lastSlot: 0, nextSlot: null, tickCount: 0,
    scheduler: { ok: false, lastScheduledAt: null, lastError: null },
    money: { actualOutside24hUsd: 0, actualKnownCost24hUsd: 0, actualNet24hUsd: 0, allTimeOutsideUsd: 0, allTimeKnownCostUsd: 0, allTimeNetUsd: 0, outsidePayers24h: 0, outsidePayments24h: 0, firstDollarAt: null, firstDollarSource: null, progressTo1000Day: 0, x402Outside24hUsd: 0, moltJobsOutside24hUsd: 0, x402Payers24h: 0, x402Payments24h: 0 },
    budget: { dailyCapUsd: DAILY_SPEND_CAP, weeklyCapUsd: WEEKLY_SPEND_CAP, unprovenTestCapUsd: UNPROVEN_TEST_CAP, spentTodayUsd: 0, spentWeekUsd: 0, availableTodayUsd: DAILY_SPEND_CAP, availableWeekUsd: WEEKLY_SPEND_CAP, spend: [] },
    demand: { checkedAt: null, baseBountyOpenApprox: 0, baseBountyExamples: [], taskBountyOpen: null, taskBountyTop: [], radarPrimary: null, error: null },
    distribution: { gatefareConfigured: Boolean(process.env.GATEFARE_PAT?.trim()), gatefareProducts: 0, gatefareRevenueUsd: 0, gatefarePublishedThisRun: 0, agent402Healthy: null, lastAction: "Existing x402 distribution remains live; dead/unavailable storefronts are not a setup priority.", error: null },
    moltJobs: blankMoltJobs(),
    kalshiLive: { live: k.live, configured: k.configured, armed: k.armed, killSwitch: k.killSwitch, maxCapitalUsd: k.maxCapitalUsd },
    experiments: [], seenRevenue: [], errors: [],
  };
}

function migrateState(raw: any): PortfolioState {
  const base = blank();
  const state: PortfolioState = {
    ...base, ...raw, v: 66,
    scheduler: { ...base.scheduler, ...(raw?.scheduler || {}) },
    money: { ...base.money, ...(raw?.money || {}) },
    budget: { ...base.budget, ...(raw?.budget || {}), spend: Array.isArray(raw?.budget?.spend) ? raw.budget.spend : [] },
    demand: { ...base.demand, ...(raw?.demand || {}), baseBountyExamples: Array.isArray(raw?.demand?.baseBountyExamples) ? raw.demand.baseBountyExamples : [], taskBountyTop: Array.isArray(raw?.demand?.taskBountyTop) ? raw.demand.taskBountyTop : [] },
    distribution: { ...base.distribution, ...(raw?.distribution || {}) },
    moltJobs: { ...base.moltJobs, ...(raw?.moltJobs || {}), payouts: Array.isArray(raw?.moltJobs?.payouts) ? raw.moltJobs.payouts : [] },
    kalshiLive: { ...base.kalshiLive, ...(raw?.kalshiLive || {}) },
    experiments: Array.isArray(raw?.experiments) ? raw.experiments : [],
    seenRevenue: Array.isArray(raw?.seenRevenue) ? raw.seenRevenue : [],
    errors: Array.isArray(raw?.errors) ? raw.errors : [],
  };
  return state;
}

function encode(state: PortfolioState) {
  const body = deflateRawSync(Buffer.from(JSON.stringify(state))).toString("base64");
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
    return parsed?.v === 65 || parsed?.v === 66 ? migrateState(parsed) : null;
  } catch { return null; }
}

export async function loadPortfolioState() {
  try {
    const r = await fetch(`${NTFY}/${encodeURIComponent(topic())}/json?poll=1&since=latest`, { headers: { accept: "application/x-ndjson,application/json" }, cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const rows = (await r.text()).split(/\r?\n/).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(x => x?.event === "message" && typeof x?.message === "string");
    return rows.length ? decode(rows[rows.length - 1].message) : null;
  } catch { return null; }
}

async function save(state: PortfolioState) {
  state.experiments = state.experiments.slice(0, 12); state.seenRevenue = state.seenRevenue.slice(-80); state.errors = state.errors.slice(0, 5); state.budget.spend = state.budget.spend.slice(-40); state.moltJobs.payouts = state.moltJobs.payouts.slice(-12);
  let message = encode(state);
  if (message.length > 3900) { state.demand.baseBountyExamples = state.demand.baseBountyExamples.slice(0, 2); state.demand.taskBountyTop = state.demand.taskBountyTop.slice(0, 3); state.experiments = state.experiments.slice(0, 8); state.moltJobs.payouts = state.moltJobs.payouts.slice(-6); message = encode(state); }
  if (message.length > 4000) throw new Error(`portfolio state exceeded ntfy limit (${message.length})`);
  const r = await fetch(`${NTFY}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: topic(), title: "PennyRail portfolio v66 Revenue Strike", message, priority: 1 }), cache: "no-store", signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error(`ntfy portfolio write HTTP ${r.status}`);
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

  upsert(state, { id: "moltjobs-live-5usdc", lane: "funded agent work", task: MOLTJOBS_TARGET_TITLE, demandSource: "MoltJobs protected on-chain USDC escrow", buyerPriceUsd: MOLTJOBS_TARGET_BUDGET_USDC, upstreamCostUsd: 0, platformFeesUsd: 0.25, expectedMarginUsd: 4.75, actualSpendUsd: 0, actualRevenueUsd: state.moltJobs.settledRevenueUsd, actualNetUsd: state.moltJobs.settledRevenueUsd, outsidePayers: state.moltJobs.settledRevenueUsd > 0 ? 1 : 0, repeats: state.moltJobs.payouts.length, status: state.moltJobs.settledRevenueUsd > 0 ? "scale" : state.moltJobs.configured ? "live" : "blocked", lastAction: state.moltJobs.lastAction, nextAction: state.moltJobs.nextAction });
  upsert(state, { id: "existing-paid-distribution", lane: "multi-market distribution", task: "Keep existing paid PennyRail capabilities exposed on live x402 discovery surfaces", demandSource: "Agent402/Bazaar/x402", buyerPriceUsd: null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: null, actualSpendUsd: 0, actualRevenueUsd: state.money.x402Outside24hUsd, actualNetUsd: state.money.x402Outside24hUsd, outsidePayers: state.money.outsidePayers24h, repeats: state.money.outsidePayments24h, status: state.money.x402Outside24hUsd > 0 ? "scale" : "live", lastAction: state.distribution.lastAction, nextAction: "Keep measuring actual outside settlements while direct funded-work lanes execute." });
  const topJob = state.demand.taskBountyTop[0];
  upsert(state, { id: "other-funded-agent-jobs", lane: "agent jobs/bounties", task: "Keep TaskBounty/BaseBounty listeners active for additional funded work", demandSource: "TaskBounty + BaseBounty", buyerPriceUsd: topJob?.rewardUsd ?? null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: topJob?.rewardUsd ?? null, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: 0, status: process.env.TASKBOUNTY_API_KEY?.trim() ? "live" : "observed", lastAction: `Observed ${state.demand.taskBountyOpen ?? 0} TaskBounty jobs and ~${state.demand.baseBountyOpenApprox} BaseBounty reward markers.`, nextAction: "Claim only work with a reliable automated deliverable and verifiable positive expected net." });
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

  // Direct funded work gets checked every 10-minute tick rather than waiting for
  // the hourly heavy scan. A bid costs no cash under MoltJobs' free bid credits.
  try { await runMoltJobs(state); } catch (e) { state.errors.unshift(`MoltJobs: ${e instanceof Error ? e.message : String(e)}`); }

  const shouldHeavy = state.tickCount === 0 || (state.tickCount + 1) % 6 === 0;
  if (shouldHeavy) { try { await heavy(state); } catch (e) { state.errors.unshift(e instanceof Error ? e.message : String(e)); } }
  const k = kalshiLiveConfig(); state.kalshiLive = { live: k.live, configured: k.configured, armed: k.armed, killSwitch: k.killSwitch, maxCapitalUsd: k.maxCapitalUsd };
  recomputeMoney(state); state.tickCount += 1; state.lastTickAt = nowIso(); state.lastSlot = slot;
  const nextSlot = Math.floor(Date.now() / 1000) + INTERVAL_SECONDS; state.nextSlot = nextSlot;
  try { await scheduleNext(nextSlot, state); state.scheduler = { ok: true, lastScheduledAt: nowIso(), lastError: null }; } catch (e) { state.scheduler = { ok: false, lastScheduledAt: state.scheduler.lastScheduledAt, lastError: e instanceof Error ? e.message : String(e) }; state.errors.unshift(state.scheduler.lastError || "scheduler failed"); }
  await save(state); return { ok: true, heavy: shouldHeavy, state };
}

export async function portfolioStatus() { const state = await loadPortfolioState(); return { ok: Boolean(state), state: state || blank() }; }
