import { createHash } from "node:crypto";
import { BATCHRAIL_TRIAL_PATH, BATCHRAIL_TRIAL_PRICE_USD } from "@/lib/batchrail";
import { buyerAccount, paidFetchBaseUsdcCapped, radarBuyerAddress } from "@/lib/radar-buyer";
import { mode, payTo } from "@/lib/x402-server";

const NTFY = "https://ntfy.sh";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913";

type SeedState = {
  v: 1;
  status: "attempted" | "seeded" | "failed";
  at: string;
  url: string;
  error: string | null;
  paymentResponsePresent: boolean;
};

function secret() {
  return process.env.RADAR_ADMIN_TOKEN?.trim() || process.env.CDP_WALLET_SECRET?.trim() || process.env.CDP_API_KEY_SECRET?.trim() || "";
}

function topic() {
  const s = secret();
  if (!s) throw new Error("BatchRail activation state secret is unavailable");
  return `pennyrail-${createHash("sha256").update(`batchrail-v67:${s}`).digest("hex").slice(0, 40)}`;
}

export async function batchRailActivationState(): Promise<SeedState | null> {
  try {
    const response = await fetch(`${NTFY}/${encodeURIComponent(topic())}/json?poll=1&since=latest`, {
      headers: { accept: "application/x-ndjson,application/json" }, cache: "no-store", signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return null;
    const rows = (await response.text()).split(/\r?\n/).map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(row => row?.event === "message" && typeof row?.message === "string");
    if (!rows.length) return null;
    const parsed = JSON.parse(rows[rows.length - 1].message);
    return parsed?.v === 1 ? parsed as SeedState : null;
  } catch { return null; }
}

async function saveSeedState(state: SeedState) {
  const response = await fetch(`${NTFY}/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: topic(), title: "PennyRail BatchRail activation", message: JSON.stringify(state), priority: 1 }),
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`BatchRail activation state write HTTP ${response.status}`);
}

function cleanOrigin(raw: string) {
  return raw.replace(/\/$/, "");
}

function safeSeller() {
  return mode === "mainnet" && /^0x[0-9a-fA-F]{40}$/.test(String(payTo || "")) && !/^0x0{40}$/i.test(String(payTo || ""));
}

async function buyerBaseUsdcBalanceUsd(): Promise<number> {
  const account = await buyerAccount();
  const page = await account.listTokenBalances({ network: "base" });
  const balances = Array.isArray(page?.balances) ? page.balances : [];
  const row = balances.find((item: any) => {
    const contract = String(item?.token?.contractAddress || "").toLowerCase();
    const symbol = String(item?.token?.symbol || "").toUpperCase();
    return contract === BASE_USDC || symbol === "USDC";
  });
  if (!row) return 0;
  const raw = String(row?.amount?.amount ?? "0");
  const decimals = Math.max(0, Math.min(18, Number(row?.amount?.decimals ?? 6)));
  let atomic = 0n;
  try { atomic = BigInt(raw); } catch { return 0; }
  return Number(atomic) / (10 ** decimals);
}

function paymentDiagnostics(response: Response) {
  const required = response.headers.get("payment-required") || response.headers.get("x-payment-required");
  const settled = response.headers.get("payment-response") || response.headers.get("x-payment-response");
  return {
    paymentRequiredPresent: Boolean(required),
    paymentRequiredPreview: required ? required.slice(0, 600) : null,
    paymentResponsePresent: Boolean(settled),
  };
}

export async function activateBatchRailDiscovery(publicOrigin: string) {
  const origin = cleanOrigin(publicOrigin);
  const url = `${origin}${BATCHRAIL_TRIAL_PATH}`;
  let buyer: string | null = null;
  try { buyer = String(await radarBuyerAddress()); } catch {}

  if (!safeSeller()) {
    return { ok: false, activated: false, spentUsd: 0, stage: "rail", buyerAddress: buyer, error: "BatchRail activation requires the existing Base-mainnet PennyRail seller rail." };
  }

  const previous = await batchRailActivationState();
  if (previous?.status === "seeded") {
    return { ok: true, activated: true, alreadyActivated: true, spentUsd: 0, stage: "already-seeded", buyerAddress: buyer, seed: previous };
  }
  if (previous?.status === "attempted" && Date.now() - Date.parse(previous.at) < 15 * 60_000) {
    return { ok: false, activated: false, spentUsd: 0, stage: "cooldown", buyerAddress: buyer, error: "A BatchRail seed settlement is already in-flight/recent; duplicate spend is suppressed." };
  }

  const sample = {
    labels: ["bug", "feature", "question"],
    instruction: "Classify each support message by intent.",
    items: ["Checkout fails after login", "Please add dark mode", "Where is my invoice?"],
  };
  const requestInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(sample),
    cache: "no-store",
  };

  try {
    // Never sign a payment unless the newly deployed route first proves it is
    // actually protected by x402. This is a direct distribution activation,
    // not a synthetic revenue event; the ledger excludes the internal buyer.
    const probe = await fetch(url, { ...requestInit, signal: AbortSignal.timeout(12_000) });
    const probeDiag = paymentDiagnostics(probe);
    if (probe.status !== 402) {
      const raw = await probe.text();
      return { ok: false, activated: false, spentUsd: 0, stage: "preflight", buyerAddress: buyer, status: probe.status, ...probeDiag, error: `Expected x402 HTTP 402 before seed settlement; got ${probe.status}: ${raw.slice(0, 180)}` };
    }
    if (!probeDiag.paymentRequiredPresent) {
      return { ok: false, activated: false, spentUsd: 0, stage: "challenge", buyerAddress: buyer, status: probe.status, ...probeDiag, error: "BatchRail returned HTTP 402 without a Payment-Required header, so an x402 client cannot construct the settlement." };
    }

    let buyerUsdcBalanceUsd: number | null = null;
    let buyerBalanceError: string | null = null;
    try { buyerUsdcBalanceUsd = await buyerBaseUsdcBalanceUsd(); }
    catch (error) { buyerBalanceError = error instanceof Error ? error.message : String(error); }
    if (buyerUsdcBalanceUsd != null && buyerUsdcBalanceUsd + 1e-9 < BATCHRAIL_TRIAL_PRICE_USD) {
      return {
        ok: false, activated: false, spentUsd: 0, stage: "funding-required", buyerAddress: buyer,
        buyerUsdcBalanceUsd, requiredUsdcUsd: BATCHRAIL_TRIAL_PRICE_USD, buyerBalanceError, ...probeDiag,
        error: `Internal Radar buyer has $${buyerUsdcBalanceUsd.toFixed(6)} USDC on Base; $${BATCHRAIL_TRIAL_PRICE_USD.toFixed(2)} is required for the one-time discovery seed.`,
      };
    }

    await saveSeedState({ v: 1, status: "attempted", at: new Date().toISOString(), url, error: null, paymentResponsePresent: false });
    const paidFetch = await paidFetchBaseUsdcCapped(BATCHRAIL_TRIAL_PRICE_USD);
    const paid = await paidFetch(url, { ...requestInit, signal: AbortSignal.timeout(55_000) });
    const raw = await paid.text();
    let body: any = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw || null; }
    const paidDiag = paymentDiagnostics(paid);
    const paymentResponsePresent = paidDiag.paymentResponsePresent;
    if (!paid.ok) {
      const state: SeedState = { v: 1, status: "failed", at: new Date().toISOString(), url, error: `HTTP ${paid.status}: ${raw.slice(0, 220)}`, paymentResponsePresent };
      await saveSeedState(state);
      return {
        ok: false, activated: false, spentUsd: paymentResponsePresent ? BATCHRAIL_TRIAL_PRICE_USD : 0,
        stage: "paid-call", buyerAddress: buyer, buyerUsdcBalanceUsd, buyerBalanceError,
        status: paid.status, response: body, probe: probeDiag, retry: paidDiag, error: state.error,
      };
    }

    const state: SeedState = { v: 1, status: "seeded", at: new Date().toISOString(), url, error: null, paymentResponsePresent };
    await saveSeedState(state);
    return {
      ok: true,
      activated: true,
      alreadyActivated: false,
      spentUsd: BATCHRAIL_TRIAL_PRICE_USD,
      stage: "settled-discovery-seed",
      buyerAddress: buyer,
      buyerUsdcBalanceUsd,
      paymentResponsePresent,
      resultCount: Number(body?.count || 0),
      note: "One internal $0.05 settlement activated the Bazaar-discovery route. It is excluded from outside revenue and will not repeat after the seed marker persists.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try { await saveSeedState({ v: 1, status: "failed", at: new Date().toISOString(), url, error: message, paymentResponsePresent: false }); } catch {}
    return {
      ok: false,
      activated: false,
      spentUsd: 0,
      stage: "activation",
      buyerAddress: buyer,
      error: message,
      hint: /insufficient/i.test(message) && buyer ? `If direct distribution activation is worth the $0.05 test, the internal buyer needs at least $0.05 USDC on Base at ${buyer}.` : null,
    };
  }
}
