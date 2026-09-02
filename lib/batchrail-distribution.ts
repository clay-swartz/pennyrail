import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { BATCHRAIL_FULL_PATH, BATCHRAIL_FULL_PRICE_USD, BATCHRAIL_TRIAL_PATH, BATCHRAIL_TRIAL_PRICE_USD } from "@/lib/batchrail";

const NTFY = "https://ntfy.sh";
const SCHEDULER = "https://aisenseapi.com/services/v1/webhook_schedule";
const X402DASH_REGISTER = "https://api.x402dash.com/v1/register";
const AGENT402_REGISTER = "https://agent402.tools/api/index/register";

type DistributionState = {
  v: 1;
  status: "distributed" | "failed";
  at: string;
  agent402Ok: boolean;
  x402DashTrialOk: boolean;
  x402DashFullOk: boolean;
  error: string | null;
};

function secret() {
  return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || "";
}

function topic() {
  const s = secret();
  if (!s) throw new Error("BatchRail distribution state secret is unavailable");
  return `pennyrail-${createHash("sha256").update(`batchrail-distribution-v68:${s}`).digest("hex").slice(0, 40)}`;
}

function cleanOrigin(raw: string) { return raw.replace(/\/$/, ""); }

function safeEqual(a: string, b: string) {
  try {
    const aa = Buffer.from(a), bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch { return false; }
}

function distributionToken(slot: number) {
  return createHmac("sha256", secret()).update(`batchrail-distribution-v68:${slot}`).digest("hex");
}

export function verifyBatchRailDistributionToken(slot: number, token: string) {
  if (!Number.isInteger(slot) || slot <= 0 || !token || !secret()) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - slot) > 30 * 60) return false;
  return safeEqual(token, distributionToken(slot));
}

async function latestState(): Promise<DistributionState | null> {
  try {
    const r = await fetch(`${NTFY}/${encodeURIComponent(topic())}/json?poll=1&since=latest`, {
      headers: { accept: "application/x-ndjson,application/json" }, cache: "no-store", signal: AbortSignal.timeout(7_000),
    });
    if (!r.ok) return null;
    const rows = (await r.text()).split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(row => row?.event === "message" && typeof row?.message === "string");
    if (!rows.length) return null;
    const parsed = JSON.parse(rows[rows.length - 1].message);
    return parsed?.v === 1 ? parsed as DistributionState : null;
  } catch { return null; }
}

async function saveState(state: DistributionState) {
  const r = await fetch(`${NTFY}/`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: topic(), title: "PennyRail BatchRail distribution", message: JSON.stringify(state), priority: 1 }),
    cache: "no-store", signal: AbortSignal.timeout(7_000),
  });
  if (!r.ok) throw new Error(`BatchRail distribution state write HTTP ${r.status}`);
}

async function postJson(url: string, body: any, timeoutMs = 15_000) {
  try {
    const r = await fetch(url, {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    });
    const raw = await r.text();
    let response: any = null;
    try { response = raw ? JSON.parse(raw) : null; } catch { response = raw || null; }
    return { ok: r.ok || r.status === 409, status: r.status, response };
  } catch (error) {
    return { ok: false, status: null, response: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function batchRailDistributionState() { return latestState(); }

export async function scheduleBatchRailDistribution(publicOrigin: string, delaySeconds = 90) {
  const prior = await latestState();
  if (prior?.status === "distributed") return { ok: true, scheduled: false, alreadyDistributed: true, state: prior };
  const origin = cleanOrigin(publicOrigin);
  const slot = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(600, Math.floor(delaySeconds)));
  const url = `${origin}/api/batch/distribute?slot=${slot}&token=${encodeURIComponent(distributionToken(slot))}`;
  const r = await fetch(SCHEDULER, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ url, delay_seconds: Math.max(60, slot - Math.floor(Date.now() / 1000)), payload: {} }),
    cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`BatchRail distribution scheduler HTTP ${r.status}: ${raw.slice(0, 220)}`);
  return { ok: true, scheduled: true, alreadyDistributed: false, slot, url: `${origin}/api/batch/distribute` };
}

export async function distributeBatchRail(publicOrigin: string) {
  const origin = cleanOrigin(publicOrigin);
  const prior = await latestState();
  if (prior?.status === "distributed") return { ok: true, alreadyDistributed: true, state: prior };

  const contact = origin;
  const [agent402, trial, full] = await Promise.all([
    postJson(AGENT402_REGISTER, { origin }),
    postJson(X402DASH_REGISTER, {
      url: `${origin}${BATCHRAIL_TRIAL_PATH}`,
      name: "PennyRail BatchRail Trial",
      description: `Bulk AI classification: up to 100 short items in one x402 settlement for $${BATCHRAIL_TRIAL_PRICE_USD.toFixed(2)}.`,
      tags: ["ai", "classification", "batch", "inference", "bulk", "x402"],
      contact,
    }),
    postJson(X402DASH_REGISTER, {
      url: `${origin}${BATCHRAIL_FULL_PATH}`,
      name: "PennyRail BatchRail Bulk Classification",
      description: `Classify up to 1,000 short items in one x402 settlement for $${BATCHRAIL_FULL_PRICE_USD.toFixed(2)} with bounded positive-margin fulfillment.`,
      tags: ["ai", "classification", "batch", "inference", "bulk", "cost-savings", "x402"],
      contact,
    }),
  ]);

  const ok = Boolean(agent402.ok && trial.ok && full.ok);
  const errors = [
    !agent402.ok ? `Agent402 ${agent402.status ?? "fetch"}: ${(agent402 as any).error || JSON.stringify(agent402.response).slice(0, 160)}` : "",
    !trial.ok ? `x402dash trial ${trial.status ?? "fetch"}: ${(trial as any).error || JSON.stringify(trial.response).slice(0, 160)}` : "",
    !full.ok ? `x402dash full ${full.status ?? "fetch"}: ${(full as any).error || JSON.stringify(full.response).slice(0, 160)}` : "",
  ].filter(Boolean);
  const state: DistributionState = {
    v: 1, status: ok ? "distributed" : "failed", at: new Date().toISOString(),
    agent402Ok: Boolean(agent402.ok), x402DashTrialOk: Boolean(trial.ok), x402DashFullOk: Boolean(full.ok),
    error: errors.length ? errors.join("; ") : null,
  };
  try { await saveState(state); } catch (error) {
    if (ok) return { ok, state, persistenceError: error instanceof Error ? error.message : String(error), agent402, x402Dash: { trial, full } };
  }
  return { ok, state, agent402, x402Dash: { trial, full } };
}
