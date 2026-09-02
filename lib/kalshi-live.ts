import { constants, createSign, randomUUID } from "node:crypto";

const BASE = "https://external-api.kalshi.com/trade-api/v2";

type RequestOptions = { method?: "GET" | "POST" | "DELETE"; query?: Record<string, string | number | undefined>; body?: unknown };

function truthy(value: string | undefined) { return /^(1|true|yes|on)$/i.test(String(value || "").trim()); }
function dollars(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export function kalshiLiveConfig() {
  const keyId = process.env.KALSHI_API_KEY_ID?.trim() || "";
  const privateKey = (process.env.KALSHI_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  const live = truthy(process.env.KALSHI_LIVE);
  const killSwitch = truthy(process.env.KALSHI_KILL_SWITCH);
  const maxCapitalUsd = Math.max(0, dollars(process.env.KALSHI_MAX_CAPITAL_USD));
  return {
    live,
    killSwitch,
    configured: Boolean(keyId && privateKey),
    keyId,
    privateKey,
    maxCapitalUsd,
    armed: live && !killSwitch && Boolean(keyId && privateKey) && maxCapitalUsd > 0,
  };
}

function signedHeaders(method: string, path: string) {
  const cfg = kalshiLiveConfig();
  if (!cfg.configured) throw new Error("Kalshi credentials are not configured");
  const timestamp = String(Date.now());
  const sign = createSign("RSA-SHA256");
  sign.update(`${timestamp}${method.toUpperCase()}${path.split("?")[0]}`);
  sign.end();
  const signature = sign.sign({ key: cfg.privateKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 }, "base64");
  return {
    "KALSHI-ACCESS-KEY": cfg.keyId,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": signature,
    accept: "application/json",
  };
}

async function request(path: string, options: RequestOptions = {}) {
  const method = options.method || "GET";
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(options.query || {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const headers: Record<string, string> = signedHeaders(method, path);
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`Kalshi ${method} ${path} HTTP ${response.status}: ${String(text).slice(0, 300)}`);
  return body;
}

export async function kalshiReconcile() {
  const cfg = kalshiLiveConfig();
  if (!cfg.configured) return { ...cfg, keyId: undefined, privateKey: undefined, balance: null, restingOrders: [], fills: [], feesUsd: 0 };
  const [balance, orders, fills] = await Promise.all([
    request("/portfolio/balance"),
    request("/portfolio/orders", { query: { status: "resting", limit: 200 } }),
    request("/portfolio/fills", { query: { limit: 200, min_ts: Math.floor(Date.now() / 1000) - 86400 } }),
  ]);
  const restingOrders = Array.isArray(orders?.orders) ? orders.orders : [];
  const fillRows = Array.isArray(fills?.fills) ? fills.fills : [];
  const restingNotionalUsd = restingOrders.reduce((sum: number, row: any) => {
    const count = dollars(row?.remaining_count_fp ?? row?.remaining_count);
    const price = dollars(row?.yes_price_dollars ?? row?.price);
    return sum + Math.max(0, count * price);
  }, 0);
  const feesUsd = fillRows.reduce((sum: number, row: any) => sum + Math.max(0, dollars(row?.fee_cost)), 0);
  return {
    live: cfg.live,
    killSwitch: cfg.killSwitch,
    configured: cfg.configured,
    armed: cfg.armed,
    maxCapitalUsd: cfg.maxCapitalUsd,
    balance,
    restingOrders,
    restingNotionalUsd: Number(restingNotionalUsd.toFixed(4)),
    fills: fillRows,
    feesUsd: Number(feesUsd.toFixed(4)),
  };
}

function assertArmed() {
  const cfg = kalshiLiveConfig();
  if (!cfg.live) throw new Error("KALSHI_LIVE is false");
  if (cfg.killSwitch) throw new Error("KALSHI_KILL_SWITCH is active");
  if (!cfg.configured) throw new Error("Kalshi credentials are not configured");
  if (!(cfg.maxCapitalUsd > 0)) throw new Error("KALSHI_MAX_CAPITAL_USD must be positive");
  return cfg;
}

export async function placeKalshiOrder(input: {
  ticker: string; side: "bid" | "ask"; count: string | number; price: string | number;
  timeInForce?: "fill_or_kill" | "good_till_canceled" | "immediate_or_cancel";
  postOnly?: boolean; expirationTime?: number; clientOrderId?: string;
}) {
  const cfg = assertArmed();
  const count = dollars(input.count);
  const price = dollars(input.price);
  if (!(count > 0) || !(price > 0 && price < 1)) throw new Error("invalid Kalshi order count/price");
  const newNotional = count * price;
  const reconciled = await kalshiReconcile();
  const restingNotionalUsd = Number(reconciled.restingNotionalUsd || 0);
  if (restingNotionalUsd + newNotional > cfg.maxCapitalUsd + 1e-9) {
    throw new Error(`Kalshi capital cap would be exceeded (${(restingNotionalUsd + newNotional).toFixed(2)} > ${cfg.maxCapitalUsd.toFixed(2)})`);
  }
  return await request("/portfolio/events/orders", {
    method: "POST",
    body: {
      ticker: input.ticker,
      client_order_id: input.clientOrderId || randomUUID(),
      side: input.side,
      count: count.toFixed(2),
      price: price.toFixed(4),
      time_in_force: input.timeInForce || "good_till_canceled",
      self_trade_prevention_type: "taker_at_cross",
      post_only: input.postOnly ?? true,
      cancel_order_on_pause: true,
      expiration_time: input.expirationTime,
      reduce_only: false,
      subaccount: 0,
      exchange_index: 0,
    },
  });
}

export async function cancelKalshiOrder(orderId: string) {
  assertArmed();
  if (!orderId.trim()) throw new Error("orderId required");
  return await request(`/portfolio/events/orders/${encodeURIComponent(orderId.trim())}`, { method: "DELETE" });
}

export async function cancelAllKalshiOrders() {
  assertArmed();
  const reconciled = await kalshiReconcile();
  const ids = reconciled.restingOrders.map((row: any) => String(row?.order_id || "")).filter(Boolean);
  const results = [];
  for (const id of ids) {
    try { results.push({ id, ok: true, result: await cancelKalshiOrder(id) }); }
    catch (error) { results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  return { attempted: ids.length, results };
}
