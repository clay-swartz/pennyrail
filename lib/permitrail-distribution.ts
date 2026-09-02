import { createHmac, timingSafeEqual } from "node:crypto";
import { loadPermitRailState, updatePermitRailDistribution } from "@/lib/permitrail";

const SCHEDULER = "https://aisenseapi.com/services/v1/webhook_schedule";
const X402DASH_REGISTER = "https://api.x402dash.com/v1/register";
const AGENT402_REGISTER = "https://agent402.tools/api/index/register";

function secret() {
  return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || process.env.STRIPE_SECRET_KEY?.trim() || "";
}
function safeEqual(a: string, b: string) {
  try { const aa = Buffer.from(a), bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); } catch { return false; }
}
function token(slot: number) { return createHmac("sha256", secret()).update(`permitrail-distribution-v69:${slot}`).digest("hex"); }
export function verifyPermitRailDistributionToken(slot: number, t: string) {
  return Boolean(secret()) && Number.isInteger(slot) && slot > 0 && Math.abs(Math.floor(Date.now() / 1000) - slot) <= 30 * 60 && safeEqual(t, token(slot));
}

async function postJson(url: string, body: unknown, timeout = 15_000) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(timeout) });
    const raw = await r.text();
    let response: any = null;
    try { response = raw ? JSON.parse(raw) : null; } catch { response = raw || null; }
    return { ok: r.ok || r.status === 409, status: r.status, response };
  } catch (error) {
    return { ok: false, status: null, response: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function schedulePermitRailDistribution(publicOrigin: string, delaySeconds = 120) {
  const prior = await loadPermitRailState();
  if (prior?.distribution?.agent402Ok && prior?.distribution?.x402DashFeedOk && prior?.distribution?.x402DashTerritoryOk) {
    return { ok: true, scheduled: false, alreadyDistributed: true, slot: null };
  }
  const origin = publicOrigin.replace(/\/$/, "");
  const slot = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(600, Math.floor(delaySeconds)));
  const url = `${origin}/api/permitrail/distribute?slot=${slot}&token=${encodeURIComponent(token(slot))}`;
  const r = await fetch(SCHEDULER, {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ url, delay_seconds: Math.max(60, slot - Math.floor(Date.now() / 1000)), payload: {} }),
    cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`PermitRail distribution scheduler HTTP ${r.status}: ${raw.slice(0, 220)}`);
  return { ok: true, scheduled: true, slot };
}

export async function distributePermitRail(publicOrigin: string) {
  const origin = publicOrigin.replace(/\/$/, "");
  const [agent402, feed, territory] = await Promise.all([
    postJson(AGENT402_REGISTER, { origin }),
    postJson(X402DASH_REGISTER, {
      url: `${origin}/api/permitrail/feed`,
      name: "PennyRail PermitRail Project Intelligence",
      description: "Fresh DFW public-record project intelligence scored by trade, recency, value and downstream opportunity. Up to 100 signals per paid request.",
      tags: ["permits", "construction", "leads", "dfw", "contractors", "project-intelligence", "x402"],
      contact: origin,
    }),
    postJson(X402DASH_REGISTER, {
      url: `${origin}/api/permitrail/territory`,
      name: "PennyRail PermitRail Territory Pack",
      description: "High-volume DFW permit/project intelligence pack with trade and city filters, source evidence and scoring. Up to 500 signals per paid request.",
      tags: ["permits", "construction", "territory", "leads", "dfw", "data", "x402"],
      contact: origin,
    }),
  ]);
  const errors = [
    !agent402.ok ? `Agent402 ${agent402.status ?? "fetch"}: ${(agent402 as any).error || JSON.stringify(agent402.response).slice(0, 160)}` : "",
    !feed.ok ? `x402dash feed ${feed.status ?? "fetch"}: ${(feed as any).error || JSON.stringify(feed.response).slice(0, 160)}` : "",
    !territory.ok ? `x402dash territory ${territory.status ?? "fetch"}: ${(territory as any).error || JSON.stringify(territory.response).slice(0, 160)}` : "",
  ].filter(Boolean);
  const state = await updatePermitRailDistribution({
    agent402Ok: Boolean(agent402.ok),
    x402DashFeedOk: Boolean(feed.ok),
    x402DashTerritoryOk: Boolean(territory.ok),
    error: errors.length ? errors.join("; ") : null,
  });
  return { ok: Boolean(agent402.ok && feed.ok && territory.ok), state, agent402, x402dash: { feed, territory } };
}
