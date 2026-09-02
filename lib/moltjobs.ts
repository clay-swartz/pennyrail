import { agentTaskDeliverable, agentTaskRowsSha256 } from "@/lib/revenue-strike-data";

const DEFAULT_API = "https://api.moltjobs.io/v1";
export const MOLTJOBS_TARGET_JOB_ID = "880565e8-77b2-4ef5-8d12-4611f5d303ba";
export const MOLTJOBS_TARGET_TITLE = "Compile 40 agent-suitable tasks from public freelance boards";
export const MOLTJOBS_TARGET_BUDGET_USDC = 5;

export type MoltJobsPayout = { key: string; at: string; usd: number; txHash: string | null };
export type MoltJobsState = {
  configured: boolean;
  checkedAt: string | null;
  agentId: string | null;
  openJobs: number;
  targetOpen: boolean;
  targetJobStatus: string | null;
  bidId: string | null;
  bidStatus: string | null;
  deliverableUrl: string;
  proofHash: string;
  walletAddress: string | null;
  walletBalanceUsd: number;
  settledRevenueUsd: number;
  payouts: MoltJobsPayout[];
  submittedAt: string | null;
  lastAction: string;
  nextAction: string;
  error: string | null;
};

function apiBase() {
  return (process.env.MOLTJOBS_API_URL?.trim() || DEFAULT_API).replace(/\/$/, "");
}

function key() {
  return process.env.MOLTJOBS_API_KEY?.trim() || "";
}

function unwrap<T = any>(body: any): T {
  return body && typeof body === "object" && "data" in body ? body.data as T : body as T;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

async function request(path: string, init: RequestInit = {}) {
  const apiKey = key();
  if (!apiKey) throw new Error("MOLTJOBS_API_KEY is not configured");
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "user-agent": "PennyRail-Revenue-Strike/1.0",
      "x-api-key": apiKey,
      authorization: `Bearer ${apiKey}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const raw = await response.text();
  let body: any = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!response.ok) {
    const primary = typeof body === "string"
      ? body
      : text(body?.detail || body?.message || body?.title || "request failed");
    const validation = Array.isArray(body?.errors)
      ? body.errors.map((row: any) => {
          if (typeof row === "string") return row;
          const field = text(row?.field || row?.path || row?.name);
          const message = text(row?.message || row?.detail || row?.error || JSON.stringify(row));
          return field ? `${field}: ${message}` : message;
        }).filter(Boolean).join("; ")
      : "";
    const detail = [primary, validation].filter(Boolean).join(" — ");
    throw new Error(`MoltJobs ${path} HTTP ${response.status}: ${detail.slice(0, 700)}`);
  }
  return unwrap(body);
}

function defaultState(publicOrigin: string, prior?: Partial<MoltJobsState> | null): MoltJobsState {
  return {
    configured: Boolean(key()),
    checkedAt: prior?.checkedAt || null,
    agentId: prior?.agentId || null,
    openJobs: num(prior?.openJobs),
    targetOpen: Boolean(prior?.targetOpen),
    targetJobStatus: prior?.targetJobStatus || null,
    bidId: prior?.bidId || null,
    bidStatus: prior?.bidStatus || null,
    deliverableUrl: `${publicOrigin.replace(/\/$/, "")}/api/revenue-deliverables/moltjobs-agent-tasks`,
    proofHash: agentTaskRowsSha256(),
    walletAddress: prior?.walletAddress || null,
    walletBalanceUsd: num(prior?.walletBalanceUsd),
    settledRevenueUsd: num(prior?.settledRevenueUsd),
    payouts: Array.isArray(prior?.payouts) ? prior!.payouts!.slice(-20) : [],
    submittedAt: prior?.submittedAt || null,
    lastAction: prior?.lastAction || "Revenue Strike waiting for MoltJobs credential.",
    nextAction: prior?.nextAction || "Configure one MoltJobs agent API key to bid on live escrow-funded work.",
    error: null,
  };
}

async function verifyDeliverable(url: string, expectedHash: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "PennyRail-Revenue-Strike/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`deliverable URL HTTP ${response.status}`);
  const body = await response.json();
  if (Number(body?.rowCount) < 40) throw new Error(`deliverable only has ${Number(body?.rowCount) || 0} rows`);
  if (String(body?.proofSha256 || "") !== expectedHash) throw new Error("deliverable proof hash mismatch");
  return body;
}

function incomingTransaction(row: any) {
  const type = text(row?.type).toUpperCase();
  const amount = num(row?.amount);
  if (!(amount > 0)) return false;
  if (/WITHDRAW|DEBIT|FUND|DEPOSIT_OUT|PURCHASE|FEE/.test(type)) return false;
  return /PAYOUT|RELEASE|EARN|CREDIT|REWARD|JOB|ESCROW/.test(type);
}

function ingestPayouts(state: MoltJobsState, transactions: any[]) {
  const known = new Set(state.payouts.map(row => row.key));
  for (const row of transactions) {
    if (!incomingTransaction(row)) continue;
    const txHash = text(row?.txHash) || null;
    const at = text(row?.createdAt) || new Date().toISOString();
    const usd = Math.max(0, num(row?.amount));
    const eventKey = txHash || `${text(row?.id)}:${at}:${usd}:${text(row?.type)}`;
    if (!eventKey || known.has(eventKey) || !(usd > 0)) continue;
    state.payouts.push({ key: eventKey, at, usd, txHash });
    state.settledRevenueUsd = Number((state.settledRevenueUsd + usd).toFixed(6));
    known.add(eventKey);
  }
  state.payouts = state.payouts.slice(-20);
}

function ownBid(rows: any[], agentId: string) {
  return rows.find(row => text(row?.agentId) === agentId || text(row?.agent?.id) === agentId) || null;
}

function statusOf(row: any) {
  return text(row?.status || row?.state).toUpperCase() || null;
}

export async function runMoltJobsRevenueStrike(
  publicOrigin: string,
  prior?: Partial<MoltJobsState> | null,
): Promise<MoltJobsState> {
  const state = defaultState(publicOrigin, prior);
  state.checkedAt = new Date().toISOString();
  state.configured = Boolean(key());
  state.error = null;

  if (!state.configured) {
    state.lastAction = "MoltJobs executor is code-ready; no bid can be placed without an agent key.";
    state.nextAction = "Add MOLTJOBS_API_KEY. The target job is 5 USDC and the required deliverable is already built.";
    return state;
  }

  try {
    const deliverable = await verifyDeliverable(state.deliverableUrl, state.proofHash);
    const me: any = await request("/agents/me");
    const agentId = text(me?.id || me?.agentId);
    if (!agentId) throw new Error("MoltJobs /agents/me returned no agent id");
    state.agentId = agentId;

    const [openResult, mineResult, walletResult, txResult] = await Promise.allSettled([
      request("/jobs?status=OPEN&limit=100"),
      request(`/agents/${encodeURIComponent(agentId)}/jobs`),
      request(`/agents/${encodeURIComponent(agentId)}/wallet`),
      request(`/agents/${encodeURIComponent(agentId)}/wallet/transactions`),
    ]);

    const openJobs = openResult.status === "fulfilled" && Array.isArray(openResult.value) ? openResult.value : [];
    const mine = mineResult.status === "fulfilled" && Array.isArray(mineResult.value) ? mineResult.value : [];
    state.openJobs = openJobs.length;
    const targetOpen = openJobs.find((j: any) => text(j?.id) === MOLTJOBS_TARGET_JOB_ID) || null;
    const mineTarget = mine.find((j: any) => text(j?.id) === MOLTJOBS_TARGET_JOB_ID) || null;
    state.targetOpen = Boolean(targetOpen);
    state.targetJobStatus = statusOf(mineTarget || targetOpen);

    if (walletResult.status === "fulfilled") {
      const wallet: any = walletResult.value || {};
      state.walletAddress = text(wallet?.address) || null;
      state.walletBalanceUsd = num(wallet?.balanceUsdc);
    }
    if (txResult.status === "fulfilled" && Array.isArray(txResult.value)) ingestPayouts(state, txResult.value);

    if (mineTarget) {
      let status = statusOf(mineTarget) || "ASSIGNED";
      state.targetJobStatus = status;

      if (["APPROVED", "PAID", "COMPLETED", "SETTLED"].includes(status)) {
        state.lastAction = `Target job is ${status}; MoltJobs wallet is being reconciled for settled USDC.`;
        state.nextAction = "Keep watching wallet transactions and scale into the next funded job after settlement.";
        return state;
      }

      if (["SUBMITTED", "UNDER_REVIEW", "REVIEW", "DELIVERED"].includes(status)) {
        state.lastAction = `5 USDC job is ${status}; deliverable and proof hash are already submitted.`;
        state.nextAction = "Wait for poster approval and record only actual settled wallet credit as revenue.";
        return state;
      }

      if (["ASSIGNED", "ACCEPTED", "AWARDED", "READY"].includes(status)) {
        try {
          const started: any = await request(`/jobs/${encodeURIComponent(MOLTJOBS_TARGET_JOB_ID)}/start`, { method: "PATCH" });
          status = statusOf(started) || "IN_PROGRESS";
          state.targetJobStatus = status;
          state.lastAction = "Bid won. PennyRail started the funded job automatically.";
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (!/already|progress|started/i.test(msg)) throw error;
          status = "IN_PROGRESS";
        }
      }

      if (["IN_PROGRESS", "STARTED", "WORKING", "ASSIGNED", "ACCEPTED", "AWARDED", "READY"].includes(status)) {
        const submitted: any = await request(`/jobs/${encodeURIComponent(MOLTJOBS_TARGET_JOB_ID)}/submit`, {
          method: "PATCH",
          body: JSON.stringify({
            outputData: {
              url: state.deliverableUrl,
              format: "json",
              rowCount: deliverable.rowCount,
              checkedAt: deliverable.checkedAt,
              proofSha256: state.proofHash,
            },
            proofHash: state.proofHash,
          }),
        });
        state.targetJobStatus = statusOf(submitted) || "SUBMITTED";
        state.submittedAt = new Date().toISOString();
        state.lastAction = "PennyRail submitted the completed 40-row deliverable and SHA-256 proof automatically.";
        state.nextAction = "Watch for approval and actual USDC settlement; then bid the next validated funded task.";
        return state;
      }

      state.lastAction = `Target job is in MoltJobs account with status ${status}.`;
      state.nextAction = "Keep checking until the job becomes startable/submittable or settles.";
      return state;
    }

    let bid: any = null;
    if (state.bidId) {
      state.lastAction = `Bid ${state.bidId} already recorded; waiting for poster decision.`;
      state.nextAction = "If accepted, PennyRail will start and submit the already-built deliverable automatically.";
      return state;
    }

    try {
      const bidsRaw: any = await request(`/jobs/${encodeURIComponent(MOLTJOBS_TARGET_JOB_ID)}/bids`);
      const bids = Array.isArray(bidsRaw) ? bidsRaw : [];
      bid = ownBid(bids, agentId);
    } catch {}

    if (bid) {
      state.bidId = text(bid?.id) || null;
      state.bidStatus = statusOf(bid);
      state.lastAction = `Existing ${state.bidStatus || "pending"} bid found on the 5 USDC target.`;
      state.nextAction = "If accepted, PennyRail will start and submit the completed deliverable automatically.";
      return state;
    }

    if (!targetOpen) {
      state.lastAction = "The exact 5 USDC target is no longer in MoltJobs OPEN inventory.";
      state.nextAction = "Keep scanning funded work; do not spend or submit speculative work to a closed job.";
      return state;
    }

    // The authenticated /apply endpoint is the safest earning path because the
    // API key already identifies the agent. It avoids sending a human-facing
    // handle into the stricter /bids schema (which may require an internal UUID).
    // Keep the cover letter deliberately short to stay below marketplace text limits.
    const coverLetter =
      `40-row deliverable is complete: ${state.deliverableUrl} ` +
      `SHA-256 ${state.proofHash}`;

    let created: any;
    try {
      created = await request(`/jobs/${encodeURIComponent(MOLTJOBS_TARGET_JOB_ID)}/apply`, {
        method: "POST",
        body: JSON.stringify({
          bidAmount: MOLTJOBS_TARGET_BUDGET_USDC,
          coverLetter,
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // MoltJobs' current SDK exposes both /apply and /bids. Only fall back
      // when /apply itself is unavailable; validation/certification errors are
      // real blockers and must be surfaced rather than hidden by another bid.
      if (!/HTTP (404|405):/i.test(message)) throw error;
      created = await request(`/jobs/${encodeURIComponent(MOLTJOBS_TARGET_JOB_ID)}/bids`, {
        method: "POST",
        body: JSON.stringify({ amount: MOLTJOBS_TARGET_BUDGET_USDC, coverLetter }),
      });
    }
    state.bidId = text(created?.id || created?.bidId) || null;
    state.bidStatus = statusOf(created) || "PENDING";
    state.lastAction = `Placed a ${MOLTJOBS_TARGET_BUDGET_USDC} USDC bid on the live escrow-funded job with the deliverable already complete.`;
    state.nextAction = "On acceptance, PennyRail will start and submit the proof-backed deliverable automatically.";
    return state;
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    state.lastAction = "MoltJobs Revenue Strike hit a blocking API/account condition; no speculative money was spent.";
    state.nextAction = /google|verify|cert|eval|eligible/i.test(state.error)
      ? "Complete only the specific MoltJobs verification/certification named by the API, then retry."
      : "Retry automatically on the next Portfolio tick; inspect only if the same blocker persists.";
    return state;
  }
}

export function moltJobsRevenue24h(state: MoltJobsState | null | undefined) {
  if (!state) return 0;
  const cutoff = Date.now() - 86_400_000;
  return Number((state.payouts || [])
    .filter(row => Date.parse(row.at) >= cutoff)
    .reduce((sum, row) => sum + num(row.usd), 0)
    .toFixed(6));
}

export function moltJobsNewSettledRevenue(
  before: MoltJobsState | null | undefined,
  after: MoltJobsState,
) {
  const prior = num(before?.settledRevenueUsd);
  return Number(Math.max(0, after.settledRevenueUsd - prior).toFixed(6));
}
