import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { autopilotStatus } from "@/lib/autopilot";
import { scanExternalRevenue24h } from "@/lib/revenue-ledger";
import { gatefareRevenue, syncGatefareExistingProducts } from "@/lib/portfolio-distribution";
import { kalshiLiveConfig } from "@/lib/kalshi-live";

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

export type PortfolioState = {
  v: 65; startedAt: string; lastTickAt: string | null; lastSlot: number; nextSlot: number | null; tickCount: number;
  scheduler: { ok: boolean; lastScheduledAt: string | null; lastError: string | null };
  money: { actualOutside24hUsd: number; actualKnownCost24hUsd: number; actualNet24hUsd: number; allTimeOutsideUsd: number; allTimeKnownCostUsd: number; allTimeNetUsd: number; outsidePayers24h: number; outsidePayments24h: number; firstDollarAt: string | null; firstDollarSource: string | null; progressTo1000Day: number };
  budget: { dailyCapUsd: number; weeklyCapUsd: number; unprovenTestCapUsd: number; spentTodayUsd: number; spentWeekUsd: number; availableTodayUsd: number; availableWeekUsd: number; spend: Spend[] };
  demand: { checkedAt: string | null; baseBountyOpenApprox: number; baseBountyExamples: string[]; taskBountyOpen: number | null; taskBountyTop: Array<{ id: string; title: string; rewardUsd: number }>; radarPrimary: string | null; error: string | null };
  distribution: { gatefareConfigured: boolean; gatefareProducts: number; gatefareRevenueUsd: number; gatefarePublishedThisRun: number; agent402Healthy: boolean | null; lastAction: string; error: string | null };
  kalshiLive: { live: boolean; configured: boolean; armed: boolean; killSwitch: boolean; maxCapitalUsd: number };
  experiments: PortfolioExperiment[]; seenRevenue: SeenRevenue[]; errors: string[];
};

function secret() { return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || ""; }
function origin() { const e = process.env.PENNYRAIL_PUBLIC_URL?.trim(); if (e) return e.replace(/\/$/, ""); const p = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim(); return p ? `https://${p.replace(/^https?:\/\//, "").replace(/\/$/, "")}` : "https://pennyrail.vercel.app"; }
function safeEqual(a: string, b: string) { try { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); } catch { return false; } }
function topic() { if (!secret()) throw new Error("portfolio state secret unavailable"); return `pennyrail-${createHash("sha256").update(`portfolio-v65:${secret()}`).digest("hex").slice(0, 40)}`; }
function tokenForSlot(slot: number) { return createHmac("sha256", secret()).update(`portfolio-v65:${slot}`).digest("hex"); }
export function verifyPortfolioToken(slot: number, token: string) { return Number.isInteger(slot) && slot > 0 && Boolean(token) && Boolean(secret()) && safeEqual(token, tokenForSlot(slot)); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function round(v: number, d = 6) { return Number(v.toFixed(d)); }
function nowIso() { return new Date().toISOString(); }

function blank(): PortfolioState {
  const k = kalshiLiveConfig();
  return {
    v: 65, startedAt: nowIso(), lastTickAt: null, lastSlot: 0, nextSlot: null, tickCount: 0,
    scheduler: { ok: false, lastScheduledAt: null, lastError: null },
    money: { actualOutside24hUsd: 0, actualKnownCost24hUsd: 0, actualNet24hUsd: 0, allTimeOutsideUsd: 0, allTimeKnownCostUsd: 0, allTimeNetUsd: 0, outsidePayers24h: 0, outsidePayments24h: 0, firstDollarAt: null, firstDollarSource: null, progressTo1000Day: 0 },
    budget: { dailyCapUsd: DAILY_SPEND_CAP, weeklyCapUsd: WEEKLY_SPEND_CAP, unprovenTestCapUsd: UNPROVEN_TEST_CAP, spentTodayUsd: 0, spentWeekUsd: 0, availableTodayUsd: DAILY_SPEND_CAP, availableWeekUsd: WEEKLY_SPEND_CAP, spend: [] },
    demand: { checkedAt: null, baseBountyOpenApprox: 0, baseBountyExamples: [], taskBountyOpen: null, taskBountyTop: [], radarPrimary: null, error: null },
    distribution: { gatefareConfigured: Boolean(process.env.GATEFARE_PAT?.trim()), gatefareProducts: 0, gatefareRevenueUsd: 0, gatefarePublishedThisRun: 0, agent402Healthy: null, lastAction: "Portfolio distributor waiting for tick.", error: null },
    kalshiLive: { live: k.live, configured: k.configured, armed: k.armed, killSwitch: k.killSwitch, maxCapitalUsd: k.maxCapitalUsd },
    experiments: [], seenRevenue: [], errors: [],
  };
}

function encode(state: PortfolioState) {
  const body = deflateRawSync(Buffer.from(JSON.stringify(state))).toString("base64");
  const sig = createHmac("sha256", secret()).update(`portfolio-state-v65:${body}`).digest("hex").slice(0, 40);
  return `${body}.${sig}`;
}
function decode(raw: string): PortfolioState | null {
  try { const i = raw.lastIndexOf("."); if (i < 1) return null; const body = raw.slice(0, i), sig = raw.slice(i + 1); const exp = createHmac("sha256", secret()).update(`portfolio-state-v65:${body}`).digest("hex").slice(0, 40); if (!safeEqual(sig, exp)) return null; const parsed = JSON.parse(inflateRawSync(Buffer.from(body, "base64")).toString("utf8")); return parsed?.v === 65 ? parsed : null; } catch { return null; }
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
  state.experiments = state.experiments.slice(0, 12); state.seenRevenue = state.seenRevenue.slice(-80); state.errors = state.errors.slice(0, 5); state.budget.spend = state.budget.spend.slice(-40);
  let message = encode(state);
  if (message.length > 3900) { state.demand.baseBountyExamples = state.demand.baseBountyExamples.slice(0, 2); state.demand.taskBountyTop = state.demand.taskBountyTop.slice(0, 3); state.experiments = state.experiments.slice(0, 8); message = encode(state); }
  if (message.length > 4000) throw new Error(`portfolio state exceeded ntfy limit (${message.length})`);
  const r = await fetch(`${NTFY}/`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ topic: topic(), title: "PennyRail portfolio v65", message, priority: 1 }), cache: "no-store", signal: AbortSignal.timeout(7000) });
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

function ingestRevenue(state: PortfolioState, ledger: any) {
  const transfers = Array.isArray(ledger?.external?.transfers) ? ledger.external.transfers : [];
  for (const t of transfers) {
    const key = `${t?.txHash || ""}:${t?.logIndex || ""}`; const usd = Math.max(0, num(t?.amountUsd)); if (!key || !usd || state.seenRevenue.some(x => x.key === key)) continue;
    state.seenRevenue.push({ key, usd, payer: t?.sender ? String(t.sender) : null }); state.money.allTimeOutsideUsd = round(state.money.allTimeOutsideUsd + usd);
    if (!state.money.firstDollarAt) { state.money.firstDollarAt = nowIso(); state.money.firstDollarSource = "outside Base USDC to PennyRail seller wallet"; }
  }
  state.money.actualOutside24hUsd = round(num(ledger?.external?.usdcUsd));
  state.money.outsidePayers24h = num(ledger?.external?.uniquePayers); state.money.outsidePayments24h = num(ledger?.external?.transferCount);
  updateBudget(state); const since = Date.now() - 86400000;
  state.money.actualKnownCost24hUsd = round(state.budget.spend.filter(s => Date.parse(s.at) >= since).reduce((a, s) => a + s.usd, 0));
  state.money.allTimeKnownCostUsd = round(state.budget.spend.reduce((a, s) => a + s.usd, 0));
  state.money.actualNet24hUsd = round(state.money.actualOutside24hUsd - state.money.actualKnownCost24hUsd);
  state.money.allTimeNetUsd = round(state.money.allTimeOutsideUsd - state.money.allTimeKnownCostUsd);
  state.money.progressTo1000Day = round(Math.max(0, state.money.actualNet24hUsd) / 1000, 4);
}

async function heavy(state: PortfolioState) {
  const [ledgerR, autopilotR, baseR, taskR, gfSyncR, gfRevenueR] = await Promise.allSettled([
    scanExternalRevenue24h(), autopilotStatus(), scanBaseBounty(), scanTaskBounty(), syncGatefareExistingProducts(3), gatefareRevenue(30),
  ]);
  if (ledgerR.status === "fulfilled") ingestRevenue(state, ledgerR.value); else state.errors.unshift(`ledger: ${String(ledgerR.reason)}`);
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
    const g: any = gfSyncR.value; state.distribution.gatefareConfigured = Boolean(g.configured); state.distribution.gatefarePublishedThisRun = num(g.published); state.distribution.lastAction = g.configured ? `Gatefare sync: ${num(g.published)} new, ${num(g.existing)} existing.` : "Gatefare connector ready; PAT not configured."; state.distribution.error = g.errors?.length ? g.errors.join("; ") : null;
  } else state.distribution.error = String(gfSyncR.reason);
  if (gfRevenueR.status === "fulfilled") { const g: any = gfRevenueR.value; state.distribution.gatefareProducts = num(g.products); state.distribution.gatefareRevenueUsd = num(g.revenueUsd); }

  upsert(state, { id: "existing-paid-distribution", lane: "multi-market distribution", task: "Cross-list existing demand-backed PennyRail paid capabilities", demandSource: "Agent402/Bazaar/x402 + Gatefare", buyerPriceUsd: null, upstreamCostUsd: 0, platformFeesUsd: 0, expectedMarginUsd: null, actualSpendUsd: 0, actualRevenueUsd: state.money.actualOutside24hUsd, actualNetUsd: state.money.actualNet24hUsd, outsidePayers: state.money.outsidePayers24h, repeats: state.money.outsidePayments24h, status: state.money.outsidePayments24h > 1 ? "scale" : "live", lastAction: state.distribution.lastAction, nextAction: state.distribution.gatefareConfigured ? "Keep cross-listing highest-demand existing products and measure outside settlements." : "Add one Gatefare publisher PAT to activate automatic cross-listing." });
  const topJob = state.demand.taskBountyTop[0];
  upsert(state, { id: "funded-agent-jobs", lane: "agent jobs/bounties", task: "Catch funded jobs PennyRail can validate and complete", demandSource: "TaskBounty + BaseBounty", buyerPriceUsd: topJob?.rewardUsd ?? null, upstreamCostUsd: 0, platformFeesUsd: topJob?.rewardUsd ? round(topJob.rewardUsd * .2, 2) : 0, expectedMarginUsd: topJob?.rewardUsd ? round(topJob.rewardUsd * .8, 2) : null, actualSpendUsd: 0, actualRevenueUsd: 0, actualNetUsd: 0, outsidePayers: 0, repeats: 0, status: process.env.TASKBOUNTY_API_KEY?.trim() ? "shadow-test" : "observed", lastAction: `Observed ${state.demand.taskBountyOpen ?? 0} TaskBounty jobs and ~${state.demand.baseBountyOpenApprox} BaseBounty reward markers.`, nextAction: process.env.TASKBOUNTY_API_KEY?.trim() ? "Score only jobs that fit an automated, locally verifiable deliverable before claiming." : "TaskBounty adapter is code-ready; one API key unlocks authenticated access/submit when a fit appears." });
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
  const shouldHeavy = state.tickCount === 0 || (state.tickCount + 1) % 6 === 0;
  if (shouldHeavy) { try { await heavy(state); } catch (e) { state.errors.unshift(e instanceof Error ? e.message : String(e)); } }
  const k = kalshiLiveConfig(); state.kalshiLive = { live: k.live, configured: k.configured, armed: k.armed, killSwitch: k.killSwitch, maxCapitalUsd: k.maxCapitalUsd };
  updateBudget(state); state.tickCount += 1; state.lastTickAt = nowIso(); state.lastSlot = slot;
  const nextSlot = Math.floor(Date.now() / 1000) + INTERVAL_SECONDS; state.nextSlot = nextSlot;
  try { await scheduleNext(nextSlot, state); state.scheduler = { ok: true, lastScheduledAt: nowIso(), lastError: null }; } catch (e) { state.scheduler = { ok: false, lastScheduledAt: state.scheduler.lastScheduledAt, lastError: e instanceof Error ? e.message : String(e) }; state.errors.unshift(state.scheduler.lastError || "scheduler failed"); }
  await save(state); return { ok: true, heavy: shouldHeavy, state };
}

export async function portfolioStatus() { const state = await loadPortfolioState(); return { ok: Boolean(state), state: state || blank() }; }
