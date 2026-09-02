import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import {
  deflateRawSync,
  inflateRawSync,
} from "node:zlib";
import { runKalshiPaperModel } from "@/lib/kalshi-paper";
import { runMoneyRadar } from "@/lib/money-radar";
import { runMoneyHunter } from "@/lib/money-hunter";
import { scanExternalRevenue24h } from "@/lib/revenue-ledger";

const KALSHI = "https://external-api.kalshi.com/trade-api/v2";
const SCHEDULER = "https://aisenseapi.com/services/v1/webhook_schedule";
const NTFY = "https://ntfy.sh";
const INTERVAL_SECONDS = 10 * 60;
const HEAVY_EVERY_TICKS = 6;
const MAX_STATE_TICKERS = 12;
const MAX_TRACKED_PORTFOLIO = 5;

type CompactQuote = {
  t: string;
  yb: number | null;
  ya: number | null;
  nb: number | null;
  na: number | null;
  os: number;
  yd: number;
  nd: number;
  ru: number;
  rpStart: string | null;
  rpEnd: string | null;
};

type TickerStat = {
  t: string;
  seen: number;
  selected: number;
  reward: number;
  possibleFill: number;
  netTrade: number;
};

export type AutopilotState = {
  v: 61;
  startedAt: string;
  lastTickAt: string | null;
  lastSlot: number;
  nextSlot: number | null;
  tickCount: number;
  scheduler: {
    ok: boolean;
    lastScheduledAt: string | null;
    lastError: string | null;
  };
  kalshi: {
    samples: number;
    gateHits: number;
    gross24hSum: number;
    gross24hMin: number | null;
    gross24hMax: number;
    capitalSum: number;
    capitalMax: number;
    rewardAccrued: number;
    tradeGross: number;
    makerFees: number;
    exitFees: number;
    tradeNet: number;
    totalNet: number;
    peakTotalNet: number;
    maxDrawdown: number;
    tradeIntervals: number;
    tradeIntervalsWithPossibleFill: number;
    selectedMarketCountSum: number;
    tickers: TickerStat[];
    previousQuotes: CompactQuote[];
    last: {
      scheduledGross24h: number;
      capital: number;
      marketCount: number;
      targetReached: boolean;
      generatedAt: string | null;
    };
  };
  revenue: {
    checkedAt: string | null;
    external24hUsd: number;
    uniquePayers: number;
    transferCount: number;
    internalExcludedUsd: number;
    error: string | null;
  };
  radar: {
    checkedAt: string | null;
    primary: string | null;
    crossVenueArbCount: number;
    topCrossVenueGrossEdge: number | null;
    x402HunterOk: boolean | null;
    x402Agent402Registered: boolean | null;
    error: string | null;
  };
  gate: {
    elapsedHours: number;
    expectedSamples: number;
    coverage: number;
    gateHitRate: number;
    paperNetRunRateUsdPerDay: number | null;
    paperRewardRunRateUsdPerDay: number | null;
    paperTradeRunRateUsdPerDay: number | null;
    evidence24hComplete: boolean;
    liveCapitalReady: boolean;
    reason: string;
  };
  migrations?: string[];
  errors: string[];
};

function secret() {
  return (
    process.env.RADAR_ADMIN_TOKEN?.trim() ||
    process.env.CDP_WALLET_SECRET?.trim() ||
    process.env.CDP_API_KEY_SECRET?.trim() ||
    ""
  );
}

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${production
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")}`;
  }

  return "https://pennyrail.vercel.app";
}

function safeEqual(a: string, b: string) {
  try {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function topic() {
  const s = secret();
  if (!s) throw new Error("RADAR_ADMIN_TOKEN or an existing CDP secret is required");
  return `pennyrail-${createHash("sha256")
    .update(`autopilot-state-v61:${s}`)
    .digest("hex")
    .slice(0, 40)}`;
}

function tokenForSlot(slot: number) {
  const s = secret();
  if (!s) return "";
  return createHmac("sha256", s)
    .update(`pennyrail-autopilot-v61:${slot}`)
    .digest("hex");
}

export function verifyAutopilotToken(slot: number, token: string) {
  if (!Number.isInteger(slot) || slot <= 0 || !token) return false;
  return safeEqual(token, tokenForSlot(slot));
}

function newState(): AutopilotState {
  const now = new Date().toISOString();
  return {
    v: 61,
    startedAt: now,
    lastTickAt: null,
    lastSlot: 0,
    nextSlot: null,
    tickCount: 0,
    scheduler: {
      ok: false,
      lastScheduledAt: null,
      lastError: null,
    },
    kalshi: {
      samples: 0,
      gateHits: 0,
      gross24hSum: 0,
      gross24hMin: null,
      gross24hMax: 0,
      capitalSum: 0,
      capitalMax: 0,
      rewardAccrued: 0,
      tradeGross: 0,
      makerFees: 0,
      exitFees: 0,
      tradeNet: 0,
      totalNet: 0,
      peakTotalNet: 0,
      maxDrawdown: 0,
      tradeIntervals: 0,
      tradeIntervalsWithPossibleFill: 0,
      selectedMarketCountSum: 0,
      tickers: [],
      previousQuotes: [],
      last: {
        scheduledGross24h: 0,
        capital: 0,
        marketCount: 0,
        targetReached: false,
        generatedAt: null,
      },
    },
    revenue: {
      checkedAt: null,
      external24hUsd: 0,
      uniquePayers: 0,
      transferCount: 0,
      internalExcludedUsd: 0,
      error: null,
    },
    radar: {
      checkedAt: null,
      primary: null,
      crossVenueArbCount: 0,
      topCrossVenueGrossEdge: null,
      x402HunterOk: null,
      x402Agent402Registered: null,
      error: null,
    },
    gate: {
      elapsedHours: 0,
      expectedSamples: 0,
      coverage: 0,
      gateHitRate: 0,
      paperNetRunRateUsdPerDay: null,
      paperRewardRunRateUsdPerDay: null,
      paperTradeRunRateUsdPerDay: null,
      evidence24hComplete: false,
      liveCapitalReady: false,
      reason: "Collecting persistent paper evidence.",
    },
    errors: [],
  };
}

function encodeState(state: AutopilotState) {
  const compressed = deflateRawSync(
    Buffer.from(JSON.stringify(state), "utf8"),
  ).toString("base64");
  const signature = createHmac("sha256", secret())
    .update(`pennyrail-autopilot-state-v61:${compressed}`)
    .digest("hex")
    .slice(0, 40);
  return `${compressed}.${signature}`;
}

function decodeState(raw: string): AutopilotState | null {
  try {
    const split = raw.lastIndexOf(".");
    if (split <= 0) return null;
    const compressed = raw.slice(0, split);
    const signature = raw.slice(split + 1);
    const expected = createHmac("sha256", secret())
      .update(`pennyrail-autopilot-state-v61:${compressed}`)
      .digest("hex")
      .slice(0, 40);
    if (!safeEqual(signature, expected)) return null;

    const json = inflateRawSync(
      Buffer.from(compressed, "base64"),
    ).toString("utf8");
    const parsed = JSON.parse(json);
    return parsed?.v === 61 ? parsed as AutopilotState : null;
  } catch {
    return null;
  }
}

export async function loadAutopilotState(): Promise<AutopilotState | null> {
  try {
    const response = await fetch(
      `${NTFY}/${encodeURIComponent(topic())}/json?poll=1&since=latest`,
      {
        headers: { accept: "application/x-ndjson,application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(7_000),
      },
    );
    if (!response.ok) return null;

    const body = await response.text();
    const rows = body
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean)
      .filter(row => row?.event === "message" && typeof row?.message === "string");

    const last = rows[rows.length - 1];
    return last ? decodeState(last.message) : null;
  } catch {
    return null;
  }
}

async function saveAutopilotState(state: AutopilotState) {
  const message = encodeState(state);
  if (message.length > 3600) {
    state.kalshi.tickers = state.kalshi.tickers.slice(0, 6);
    state.kalshi.previousQuotes = state.kalshi.previousQuotes.slice(0, 3);
    state.errors = state.errors.slice(0, 3);
  }

  const finalMessage = encodeState(state);
  if (finalMessage.length > 4000) {
    throw new Error(`autopilot state exceeded ntfy message budget (${finalMessage.length})`);
  }

  const response = await fetch(`${NTFY}/`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      topic: topic(),
      title: "PennyRail autopilot state",
      message: finalMessage,
      tags: ["chart_with_upwards_trend"],
      priority: 1,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(7_000),
  });

  if (!response.ok) {
    throw new Error(`ntfy state write HTTP ${response.status}`);
  }
}

async function scheduleNext(slot: number, state: AutopilotState) {
  const now = Math.floor(Date.now() / 1000);
  const delay = Math.max(60, Math.min(3600, slot - now));
  const callback =
    `${origin()}/api/autopilot/tick` +
    `?slot=${encodeURIComponent(String(slot))}` +
    `&token=${encodeURIComponent(tokenForSlot(slot))}`;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(SCHEDULER, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          url: callback,
          delay_seconds: delay,
          // The next callback carries a compressed state snapshot too. ntfy is
          // still the durable status/recovery store, but this payload lets the
          // callback chain survive a temporary ntfy read/write failure.
          payload: { state: encodeState(state) },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const raw = await response.text();
      if (response.ok) {
        return {
          ok: true,
          status: response.status,
          delaySeconds: delay,
          slot,
          response: raw.slice(0, 500),
        };
      }
      lastError = `HTTP ${response.status}: ${raw.slice(0, 300)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ok: false,
    slot,
    delaySeconds: delay,
    error: lastError || "scheduler failed",
  };
}

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function price(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

function tradeYesPrice(row: any): number | null {
  const dollars = price(row?.yes_price_dollars);
  if (dollars != null) return dollars;

  const cents = Number(row?.yes_price);
  if (Number.isFinite(cents) && cents >= 0 && cents <= 100) return cents / 100;

  const generic = price(row?.price_dollars);
  return generic;
}

function tradeNoPrice(row: any, yes: number | null): number | null {
  const dollars = price(row?.no_price_dollars);
  if (dollars != null) return dollars;

  const cents = Number(row?.no_price);
  if (Number.isFinite(cents) && cents >= 0 && cents <= 100) return cents / 100;

  return yes == null ? null : 1 - yes;
}

function tradeCount(row: any) {
  return Math.max(0, num(row?.count_fp ?? row?.count ?? row?.quantity));
}

async function recentTrades(ticker: string, minTs: number) {
  const url = new URL(`${KALSHI}/markets/trades`);
  url.searchParams.set("limit", "1000");
  url.searchParams.set("ticker", ticker);
  url.searchParams.set("min_ts", String(Math.max(0, Math.floor(minTs))));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "PennyRail-Persistent-Paper/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Kalshi trades HTTP ${response.status}`);
  }

  const body = await response.json();
  return Array.isArray(body?.trades) ? body.trades : [];
}

function makerFee(contracts: number, p: number | null) {
  if (!contracts || p == null) return 0;
  return Math.ceil(100 * 0.0175 * contracts * p * (1 - p)) / 100;
}

function takerFee(contracts: number, p: number | null) {
  if (!contracts || p == null) return 0;
  return Math.ceil(100 * 0.07 * contracts * p * (1 - p)) / 100;
}

function currentQuoteMap(model: any) {
  const map = new Map<string, any>();
  const rows = Array.isArray(model?.topPaperPortfolio)
    ? model.topPaperPortfolio
    : [];
  for (const row of rows) {
    if (row?.ticker) map.set(String(row.ticker), row);
  }
  return map;
}

function buildCompactQuotes(model: any): CompactQuote[] {
  const rows = Array.isArray(model?.topPaperPortfolio)
    ? model.topPaperPortfolio
    : [];

  return rows.slice(0, MAX_TRACKED_PORTFOLIO).map((row: any) => ({
    t: String(row?.ticker || ""),
    yb: price(row?.market?.yesBid),
    ya: price(row?.market?.yesAsk),
    nb: price(row?.market?.noBid),
    na: price(row?.market?.noAsk),
    os: Math.max(0, num(row?.baseline25PctTarget?.orderSize)),
    yd: Math.max(0, num(row?.market?.yesBookDepth)),
    nd: Math.max(0, num(row?.market?.noBookDepth)),
    ru: Math.max(0, num(row?.baseline25PctTarget?.estimatedRewardThisPeriodUsd)),
    rpStart: row?.rewardPeriod?.start ? String(row.rewardPeriod.start) : null,
    rpEnd: row?.rewardPeriod?.end ? String(row.rewardPeriod.end) : null,
  })).filter((row: CompactQuote) => Boolean(row.t));
}

function intervalOverlapMinutes(
  startIso: string | null,
  endIso: string | null,
  intervalStartMs: number,
  intervalEndMs: number,
) {
  const s = startIso ? Date.parse(startIso) : intervalStartMs;
  const e = endIso ? Date.parse(endIso) : intervalEndMs;
  const start = Number.isFinite(s) ? Math.max(s, intervalStartMs) : intervalStartMs;
  const end = Number.isFinite(e) ? Math.min(e, intervalEndMs) : intervalEndMs;
  return Math.max(0, end - start) / 60_000;
}

function rewardForInterval(
  quotes: CompactQuote[],
  intervalStartMs: number,
  intervalEndMs: number,
) {
  return quotes.reduce((sum, row) => {
    if (row.ru <= 0 || !row.rpStart || !row.rpEnd) return sum;

    const periodStartMs = Date.parse(row.rpStart);
    const periodEndMs = Date.parse(row.rpEnd);
    if (
      !Number.isFinite(periodStartMs) ||
      !Number.isFinite(periodEndMs) ||
      periodEndMs <= periodStartMs
    ) {
      return sum;
    }

    const overlapMs = Math.max(
      0,
      Math.min(periodEndMs, intervalEndMs) -
        Math.max(periodStartMs, intervalStartMs),
    );
    if (overlapMs <= 0) return sum;

    return sum + row.ru * (overlapMs / (periodEndMs - periodStartMs));
  }, 0);
}

function quoteRewardRatePerMs(row: CompactQuote) {
  if (row.ru <= 0 || !row.rpStart || !row.rpEnd) return 0;
  const start = Date.parse(row.rpStart);
  const end = Date.parse(row.rpEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return row.ru / (end - start);
}

async function estimateTradeInterval(
  previous: CompactQuote[],
  model: any,
  minTs: number,
) {
  if (!previous.length) {
    return {
      observed: false,
      possibleFill: false,
      gross: 0,
      makerFees: 0,
      exitFees: 0,
      net: 0,
      byTicker: [] as any[],
    };
  }

  const current = currentQuoteMap(model);

  const rows = await Promise.all(
    previous.map(async quote => {
      try {
        const trades = await recentTrades(quote.t, minTs);
        let yesThrough = 0;
        let noThrough = 0;
        let lastYes: number | null = null;

        for (const trade of trades) {
          const yes = tradeYesPrice(trade);
          const no = tradeNoPrice(trade, yes);
          const count = tradeCount(trade);
          if (yes != null) lastYes = yes;

          if (quote.yb != null && yes != null && yes <= quote.yb + 1e-9) {
            yesThrough += count;
          }
          if (quote.nb != null && no != null && no <= quote.nb + 1e-9) {
            noThrough += count;
          }
        }

        const yesQueueShare =
          quote.os > 0 ? quote.os / Math.max(quote.os, quote.yd + quote.os) : 0;
        const noQueueShare =
          quote.os > 0 ? quote.os / Math.max(quote.os, quote.nd + quote.os) : 0;

        const yesFill = Math.min(quote.os, yesThrough * yesQueueShare);
        const noFill = Math.min(quote.os, noThrough * noQueueShare);
        const paired = Math.min(yesFill, noFill);
        const yesUnpaired = Math.max(0, yesFill - paired);
        const noUnpaired = Math.max(0, noFill - paired);

        const cur = current.get(quote.t);
        const currentYesBid =
          price(cur?.market?.yesBid) ??
          lastYes ??
          quote.yb;
        const currentNoBid =
          price(cur?.market?.noBid) ??
          (lastYes == null ? null : 1 - lastYes) ??
          quote.nb;

        const locked =
          paired *
          Math.max(0, 1 - num(quote.yb) - num(quote.nb));
        const yesExit =
          yesUnpaired *
          (num(currentYesBid, num(quote.yb)) - num(quote.yb));
        const noExit =
          noUnpaired *
          (num(currentNoBid, num(quote.nb)) - num(quote.nb));

        const mFees =
          makerFee(yesFill, quote.yb) +
          makerFee(noFill, quote.nb);
        const eFees =
          takerFee(yesUnpaired, currentYesBid) +
          takerFee(noUnpaired, currentNoBid);

        const gross = locked + yesExit + noExit;
        const net = gross - mFees - eFees;

        return {
          ticker: quote.t,
          trades: trades.length,
          yesThrough,
          noThrough,
          yesQueueShare,
          noQueueShare,
          yesFill,
          noFill,
          paired,
          gross,
          makerFees: mFees,
          exitFees: eFees,
          net,
          possibleFill: yesFill > 0 || noFill > 0,
        };
      } catch (error) {
        return {
          ticker: quote.t,
          trades: 0,
          yesFill: 0,
          noFill: 0,
          paired: 0,
          gross: 0,
          makerFees: 0,
          exitFees: 0,
          net: 0,
          possibleFill: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const successful = rows.filter(row => !("error" in row));
  return {
    observed: successful.length > 0,
    possibleFill: rows.some(row => row.possibleFill),
    gross: rows.reduce((sum, row) => sum + num(row.gross), 0),
    makerFees: rows.reduce((sum, row) => sum + num(row.makerFees), 0),
    exitFees: rows.reduce((sum, row) => sum + num(row.exitFees), 0),
    net: rows.reduce((sum, row) => sum + num(row.net), 0),
    byTicker: rows,
  };
}

function updateTickerStats(
  state: AutopilotState,
  model: any,
  intervalReward: number,
  trade: any,
  rewardQuotes: CompactQuote[],
) {
  const map = new Map(
    state.kalshi.tickers.map(row => [row.t, { ...row }]),
  );

  const selected = Array.isArray(model?.topPaperPortfolio)
    ? model.topPaperPortfolio
    : [];

  for (const row of selected) {
    const ticker = String(row?.ticker || "");
    if (!ticker) continue;

    const current = map.get(ticker) || {
      t: ticker,
      seen: 0,
      selected: 0,
      reward: 0,
      possibleFill: 0,
      netTrade: 0,
    };

    current.seen += 1;
    current.selected += 1;
    map.set(ticker, current);
  }

  const rates = rewardQuotes.map(row => ({
    row,
    rate: quoteRewardRatePerMs(row),
  }));
  const rewardDenominator = rates.reduce(
    (sum, entry) => sum + entry.rate,
    0,
  );

  if (intervalReward > 0 && rewardDenominator > 0) {
    for (const entry of rates) {
      if (entry.rate <= 0) continue;
      const ticker = entry.row.t;
      const current = map.get(ticker) || {
        t: ticker,
        seen: 0,
        selected: 0,
        reward: 0,
        possibleFill: 0,
        netTrade: 0,
      };
      current.reward += intervalReward * (entry.rate / rewardDenominator);
      map.set(ticker, current);
    }
  }

  for (const row of trade?.byTicker || []) {
    const ticker = String(row?.ticker || "");
    if (!ticker) continue;
    const current = map.get(ticker) || {
      t: ticker,
      seen: 0,
      selected: 0,
      reward: 0,
      possibleFill: 0,
      netTrade: 0,
    };
    if (row?.possibleFill) current.possibleFill += 1;
    current.netTrade += num(row?.net);
    map.set(ticker, current);
  }

  state.kalshi.tickers = [...map.values()]
    .sort(
      (a, b) =>
        b.selected - a.selected ||
        b.reward - a.reward ||
        b.possibleFill - a.possibleFill,
    )
    .slice(0, MAX_STATE_TICKERS);
}

function updateGate(state: AutopilotState) {
  const started = Date.parse(state.startedAt);
  const elapsedMs = Math.max(1, Date.now() - started);
  const elapsedHours = elapsedMs / 3_600_000;
  const elapsedDays = elapsedMs / 86_400_000;
  const expectedSamples = Math.max(
    1,
    elapsedMs / (INTERVAL_SECONDS * 1000),
  );
  const coverage = Math.min(
    1,
    state.kalshi.samples / expectedSamples,
  );
  const gateHitRate =
    state.kalshi.samples > 0
      ? state.kalshi.gateHits / state.kalshi.samples
      : 0;

  const paperNetRunRate =
    elapsedDays >= 0.05 ? state.kalshi.totalNet / elapsedDays : null;
  const paperRewardRunRate =
    elapsedDays >= 0.05 ? state.kalshi.rewardAccrued / elapsedDays : null;
  const paperTradeRunRate =
    elapsedDays >= 0.05 ? state.kalshi.tradeNet / elapsedDays : null;

  const evidence24hComplete =
    elapsedHours >= 23.5 &&
    state.kalshi.samples >= 100 &&
    coverage >= 0.70 &&
    state.kalshi.tradeIntervals >= 25;

  const liveCapitalReady =
    evidence24hComplete &&
    num(paperNetRunRate) >= 1000 &&
    gateHitRate >= 0.50 &&
    state.kalshi.maxDrawdown <= Math.max(250, state.kalshi.rewardAccrued * 0.75);

  state.gate = {
    elapsedHours: Number(elapsedHours.toFixed(2)),
    expectedSamples: Number(expectedSamples.toFixed(1)),
    coverage: Number(coverage.toFixed(4)),
    gateHitRate: Number(gateHitRate.toFixed(4)),
    paperNetRunRateUsdPerDay:
      paperNetRunRate == null ? null : Number(paperNetRunRate.toFixed(2)),
    paperRewardRunRateUsdPerDay:
      paperRewardRunRate == null ? null : Number(paperRewardRunRate.toFixed(2)),
    paperTradeRunRateUsdPerDay:
      paperTradeRunRate == null ? null : Number(paperTradeRunRate.toFixed(2)),
    evidence24hComplete,
    liveCapitalReady,
    reason:
      liveCapitalReady
        ? "Persistent paper evidence clears the $1,000/day net gate. Real capital remains disabled until explicit human authorization and Kalshi credentials are configured."
        : !evidence24hComplete
          ? "Persistent paper evidence is still accumulating; real capital remains disabled."
          : num(paperNetRunRate) < 1000
            ? "24-hour paper evidence is complete but modeled net run rate is below $1,000/day."
            : gateHitRate < 0.50
              ? "Snapshot economics are too inconsistent across the paper window."
              : "Paper risk/drawdown gate did not clear.",
  };
}

function pushError(state: AutopilotState, value: unknown) {
  const message =
    value instanceof Error ? value.message : String(value || "unknown error");
  state.errors = [
    `${new Date().toISOString()} ${message}`.slice(0, 500),
    ...state.errors,
  ].slice(0, 8);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs),
    ),
  ]);
}

async function updateHeavySignals(state: AutopilotState) {
  const [ledgerResult, radarResult, hunterResult] = await Promise.allSettled([
    withTimeout(scanExternalRevenue24h(), 20_000, "revenue ledger"),
    withTimeout(runMoneyRadar(), 25_000, "money radar"),
    withTimeout(runMoneyHunter(), 25_000, "x402 money hunter"),
  ]);

  const now = new Date().toISOString();

  if (ledgerResult.status === "fulfilled") {
    const ledger: any = ledgerResult.value;
    state.revenue.checkedAt = now;
    state.revenue.external24hUsd = num(ledger?.external?.usdcUsd);
    state.revenue.uniquePayers = num(ledger?.external?.uniquePayers);
    state.revenue.transferCount = num(ledger?.external?.transferCount);
    state.revenue.internalExcludedUsd = num(
      ledger?.internalBootstrap?.usdcUsd,
    );
    state.revenue.error =
      !ledger?.ok
        ? String(ledger?.reason || "ledger unavailable")
        : ledger?.window?.complete === false
          ? `revenue ledger partial: ${num(ledger?.window?.failedChunks)} RPC chunk(s) failed`
          : null;
  } else {
    state.revenue.checkedAt = now;
    state.revenue.error = ledgerResult.reason instanceof Error
      ? ledgerResult.reason.message
      : String(ledgerResult.reason);
    pushError(state, ledgerResult.reason);
  }

  if (radarResult.status === "fulfilled") {
    const radar: any = radarResult.value;
    state.radar.checkedAt = now;
    state.radar.primary = radar?.decision?.primary || null;
    const arbs = Array.isArray(radar?.crossVenueArbitrage?.candidates)
      ? radar.crossVenueArbitrage.candidates
      : [];
    state.radar.crossVenueArbCount = arbs.length;
    state.radar.topCrossVenueGrossEdge = arbs.length
      ? Math.max(...arbs.map((row: any) => num(row?.grossEdgeUsdPerPair)))
      : null;
    state.radar.error = null;
  } else {
    state.radar.checkedAt = now;
    state.radar.error = radarResult.reason instanceof Error
      ? radarResult.reason.message
      : String(radarResult.reason);
    pushError(state, radarResult.reason);
  }

  if (hunterResult.status === "fulfilled") {
    const hunter: any = hunterResult.value;
    state.radar.x402HunterOk = Boolean(hunter?.ok);
    const registration = Array.isArray(hunter?.automaticActions)
      ? hunter.automaticActions.find(
          (row: any) => row?.action === "REGISTER_OR_REFRESH_AGENT402_SELLER",
        )
      : null;
    state.radar.x402Agent402Registered =
      registration == null ? null : Boolean(registration?.executed);
  } else {
    state.radar.x402HunterOk = false;
    pushError(state, hunterResult.reason);
  }
}

export async function runAutopilotTick(
  slot: number,
  fallbackEncodedState?: string | null,
) {
  const persisted = await loadAutopilotState();
  const fallback = fallbackEncodedState
    ? decodeState(fallbackEncodedState)
    : null;
  const existing =
    persisted && fallback
      ? (persisted.lastSlot >= fallback.lastSlot ? persisted : fallback)
      : persisted || fallback;
  const state = existing || newState();

  // v61 credited the first observed quote snapshot retroactively. Apply one
  // explicit migration the first time this corrected code sees the old state.
  // We intentionally discard any early reward accrual accumulated before the
  // fix rather than preserve a number we cannot prove. Trade P&L is retained.
  const rewardMigration = "v62-observed-interval-reward";
  if (!(state.migrations || []).includes(rewardMigration)) {
    state.kalshi.rewardAccrued = 0;
    state.kalshi.totalNet = state.kalshi.tradeNet;
    state.kalshi.peakTotalNet = Math.max(0, state.kalshi.tradeNet);
    state.kalshi.maxDrawdown = Math.max(0, -state.kalshi.tradeNet);
    state.kalshi.tickers = state.kalshi.tickers.map(row => ({
      ...row,
      reward: 0,
    }));
    state.migrations = [
      ...(state.migrations || []),
      rewardMigration,
    ];
  }

  const scheduledRewardMigration = "v64-scheduled-period-reward";
  if (!(state.migrations || []).includes(scheduledRewardMigration)) {
    state.startedAt = new Date().toISOString();
    state.kalshi.samples = 0;
    state.kalshi.gateHits = 0;
    state.kalshi.gross24hSum = 0;
    state.kalshi.gross24hMin = null;
    state.kalshi.gross24hMax = 0;
    state.kalshi.capitalSum = 0;
    state.kalshi.capitalMax = 0;
    state.kalshi.rewardAccrued = 0;
    state.kalshi.tradeGross = 0;
    state.kalshi.makerFees = 0;
    state.kalshi.exitFees = 0;
    state.kalshi.tradeNet = 0;
    state.kalshi.totalNet = 0;
    state.kalshi.peakTotalNet = 0;
    state.kalshi.maxDrawdown = 0;
    state.kalshi.tradeIntervals = 0;
    state.kalshi.tradeIntervalsWithPossibleFill = 0;
    state.kalshi.selectedMarketCountSum = 0;
    state.kalshi.tickers = [];
    state.kalshi.previousQuotes = [];
    state.kalshi.last = {
      scheduledGross24h: 0,
      capital: 0,
      marketCount: 0,
      targetReached: false,
      generatedAt: null,
    };
    state.gate = {
      elapsedHours: 0,
      expectedSamples: 0,
      coverage: 0,
      gateHitRate: 0,
      paperNetRunRateUsdPerDay: null,
      paperRewardRunRateUsdPerDay: null,
      paperTradeRunRateUsdPerDay: null,
      evidence24hComplete: false,
      liveCapitalReady: false,
      reason: "Corrected scheduled-reward evidence window is starting.",
    };
    state.migrations = [
      ...(state.migrations || []),
      scheduledRewardMigration,
    ];
  }

  if (state.lastSlot >= slot) {
    return {
      ok: true,
      duplicate: true,
      slot,
      lastSlot: state.lastSlot,
      nextSlot: state.nextSlot,
      gate: state.gate,
    };
  }

  const previousTickMs = state.lastTickAt
    ? Date.parse(state.lastTickAt)
    : Date.now() - INTERVAL_SECONDS * 1000;
  const intervalStartMs = Number.isFinite(previousTickMs)
    ? previousTickMs
    : Date.now() - INTERVAL_SECONDS * 1000;
  const intervalEndMs = Date.now();

  const shouldRunHeavy =
    state.tickCount === 0 || (state.tickCount + 1) % HEAVY_EVERY_TICKS === 0;
  const heavyPromise = shouldRunHeavy
    ? updateHeavySignals(state).catch(error => {
        pushError(state, error);
      })
    : null;

  let model: any = null;
  try {
    model = await withTimeout(
      runKalshiPaperModel(),
      28_000,
      "Kalshi paper snapshot",
    );
  } catch (error) {
    pushError(state, error);
  }

  if (model?.ok) {
    const gate = model?.gate || {};
    const scheduledGross = Math.max(
      0,
      num(gate?.paperPortfolioScheduledGrossRewardNext24hUsd),
    );
    const capital = Math.max(
      0,
      num(gate?.estimatedPeakSimultaneousCapitalUsd),
    );
    const marketCount = Math.max(
      0,
      num(gate?.uniqueMarketCount ?? gate?.incentivePeriodCount),
    );
    const targetReached = Boolean(
      gate?.targetReachedOnScheduledNext24hGrossReward,
    );

    const currentQuotes = buildCompactQuotes(model);

    // Reward can only be credited for quotes we actually observed at the
    // beginning of the interval. The bootstrap tick has no prior quote state,
    // so it must accrue zero rather than retroactively awarding the current
    // snapshot over the previous ten minutes.
    const intervalReward =
      state.lastTickAt && state.kalshi.previousQuotes.length
        ? rewardForInterval(
            state.kalshi.previousQuotes,
            intervalStartMs,
            intervalEndMs,
          )
        : 0;

    let trade: any = {
      observed: false,
      possibleFill: false,
      gross: 0,
      makerFees: 0,
      exitFees: 0,
      net: 0,
      byTicker: [],
    };

    if (state.kalshi.previousQuotes.length && state.lastTickAt) {
      try {
        trade = await estimateTradeInterval(
          state.kalshi.previousQuotes,
          model,
          Math.max(0, Math.floor(Date.parse(state.lastTickAt) / 1000) - 2),
        );
      } catch (error) {
        pushError(state, error);
      }
    }

    state.kalshi.samples += 1;
    if (targetReached) state.kalshi.gateHits += 1;
    state.kalshi.gross24hSum += scheduledGross;
    state.kalshi.gross24hMin =
      state.kalshi.gross24hMin == null
        ? scheduledGross
        : Math.min(state.kalshi.gross24hMin, scheduledGross);
    state.kalshi.gross24hMax = Math.max(
      state.kalshi.gross24hMax,
      scheduledGross,
    );
    state.kalshi.capitalSum += capital;
    state.kalshi.capitalMax = Math.max(
      state.kalshi.capitalMax,
      capital,
    );
    state.kalshi.selectedMarketCountSum += marketCount;
    state.kalshi.rewardAccrued += intervalReward;

    if (trade.observed) state.kalshi.tradeIntervals += 1;
    if (trade.possibleFill) {
      state.kalshi.tradeIntervalsWithPossibleFill += 1;
    }

    state.kalshi.tradeGross += num(trade.gross);
    state.kalshi.makerFees += num(trade.makerFees);
    state.kalshi.exitFees += num(trade.exitFees);
    state.kalshi.tradeNet += num(trade.net);

    const intervalNet = intervalReward + num(trade.net);
    state.kalshi.totalNet += intervalNet;
    state.kalshi.peakTotalNet = Math.max(
      state.kalshi.peakTotalNet,
      state.kalshi.totalNet,
    );
    state.kalshi.maxDrawdown = Math.max(
      state.kalshi.maxDrawdown,
      state.kalshi.peakTotalNet - state.kalshi.totalNet,
    );

    updateTickerStats(
      state,
      model,
      intervalReward,
      trade,
      state.kalshi.previousQuotes,
    );

    state.kalshi.previousQuotes = currentQuotes;
    state.kalshi.last = {
      scheduledGross24h: Number(scheduledGross.toFixed(2)),
      capital: Number(capital.toFixed(2)),
      marketCount,
      targetReached,
      generatedAt: model?.generatedAt || null,
    };
  }

  state.tickCount += 1;
  state.lastSlot = slot;
  state.lastTickAt = new Date().toISOString();

  if (heavyPromise) {
    await heavyPromise;
  }

  updateGate(state);

  const now = Math.floor(Date.now() / 1000);
  const nextSlot = Math.max(
    slot + INTERVAL_SECONDS,
    Math.floor(now / INTERVAL_SECONDS) * INTERVAL_SECONDS +
      INTERVAL_SECONDS,
  );
  state.nextSlot = nextSlot;

  const scheduled = await scheduleNext(nextSlot, state);
  state.scheduler = {
    ok: scheduled.ok,
    lastScheduledAt: new Date().toISOString(),
    lastError: scheduled.ok ? null : String(scheduled?.error || "scheduler failed"),
  };

  if (!scheduled.ok) {
    pushError(state, scheduled?.error || "scheduler failed");
  }

  try {
    await saveAutopilotState(state);
  } catch (error) {
    // Do not break the callback chain if ntfy is temporarily unavailable. The
    // same compressed state is already embedded in the next scheduled payload.
    pushError(state, error);
  }

  return {
    ok: true,
    mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
    slot,
    nextSlot,
    scheduler: scheduled,
    scoreboard: {
      actualExternalRevenueApprox24hUsd: state.revenue.external24hUsd,
      actualExternalPayersApprox24h: state.revenue.uniquePayers,
      paperNetRunRateUsdPerDay: state.gate.paperNetRunRateUsdPerDay,
      paperRewardRunRateUsdPerDay: state.gate.paperRewardRunRateUsdPerDay,
      paperTradeRunRateUsdPerDay: state.gate.paperTradeRunRateUsdPerDay,
      paperSamples: state.kalshi.samples,
      paperCoverage: state.gate.coverage,
      scheduledGross24hAverageUsd:
        state.kalshi.samples > 0
          ? Number((state.kalshi.gross24hSum / state.kalshi.samples).toFixed(2))
          : null,
      scheduledGross24hMinUsd:
        state.kalshi.gross24hMin == null
          ? null
          : Number(state.kalshi.gross24hMin.toFixed(2)),
      scheduledGross24hMaxUsd:
        state.kalshi.samples > 0
          ? Number(state.kalshi.gross24hMax.toFixed(2))
          : null,
      liveCapitalReady: state.gate.liveCapitalReady,
    },
    kalshi: {
      last: state.kalshi.last,
      cumulativeRewardAccruedUsd: Number(state.kalshi.rewardAccrued.toFixed(4)),
      cumulativeTradeNetUsd: Number(state.kalshi.tradeNet.toFixed(4)),
      cumulativePaperNetUsd: Number(state.kalshi.totalNet.toFixed(4)),
      maxDrawdownUsd: Number(state.kalshi.maxDrawdown.toFixed(4)),
      tradeIntervals: state.kalshi.tradeIntervals,
      tradeIntervalsWithPossibleFill:
        state.kalshi.tradeIntervalsWithPossibleFill,
    },
    radar: state.radar,
    gate: state.gate,
    errors: state.errors.slice(0, 3),
  };
}

export async function bootstrapAutopilot() {
  const current = await loadAutopilotState();
  const now = Date.now();

  if (
    current?.lastTickAt &&
    now - Date.parse(current.lastTickAt) < 25 * 60_000 &&
    current?.scheduler?.ok
  ) {
    return {
      ok: true,
      mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
      action: "ALREADY_RUNNING",
      lastTickAt: current.lastTickAt,
      nextSlot: current.nextSlot,
      gate: current.gate,
    };
  }

  const slot =
    Math.floor(Math.floor(now / 1000) / INTERVAL_SECONDS) *
      INTERVAL_SECONDS +
    1;

  const result = await runAutopilotTick(slot);
  return {
    ...result,
    action: "BOOTSTRAPPED",
  };
}

export async function autopilotStatus() {
  const state = await loadAutopilotState();
  if (!state) {
    return {
      ok: true,
      running: false,
      mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
      action: "WAIT_FOR_DAILY_BOOTSTRAP_OR_CALL_BOOTSTRAP",
    };
  }

  const stale =
    !state.lastTickAt ||
    Date.now() - Date.parse(state.lastTickAt) > 30 * 60_000;

  return {
    ok: true,
    running: !stale,
    stale,
    mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
    startedAt: state.startedAt,
    lastTickAt: state.lastTickAt,
    nextSlot: state.nextSlot,
    tickCount: state.tickCount,
    scoreboard: {
      actualExternalRevenueApprox24hUsd: state.revenue.external24hUsd,
      actualExternalPayersApprox24h: state.revenue.uniquePayers,
      actualExternalTransfersApprox24h: state.revenue.transferCount,
      internalBootstrapExcludedUsd: state.revenue.internalExcludedUsd,
      paperNetRunRateUsdPerDay: state.gate.paperNetRunRateUsdPerDay,
      paperRewardRunRateUsdPerDay: state.gate.paperRewardRunRateUsdPerDay,
      paperTradeRunRateUsdPerDay: state.gate.paperTradeRunRateUsdPerDay,
      paperSamples: state.kalshi.samples,
      paperGateHitRate: state.gate.gateHitRate,
      paperCoverage: state.gate.coverage,
      scheduledGross24hAverageUsd:
        state.kalshi.samples > 0
          ? Number((state.kalshi.gross24hSum / state.kalshi.samples).toFixed(2))
          : null,
      scheduledGross24hMinUsd:
        state.kalshi.gross24hMin == null
          ? null
          : Number(state.kalshi.gross24hMin.toFixed(2)),
      scheduledGross24hMaxUsd:
        state.kalshi.samples > 0
          ? Number(state.kalshi.gross24hMax.toFixed(2))
          : null,
      liveCapitalReady: state.gate.liveCapitalReady,
      gateReason: state.gate.reason,
    },
    kalshi: {
      last: state.kalshi.last,
      cumulativeRewardAccruedUsd: Number(state.kalshi.rewardAccrued.toFixed(4)),
      cumulativeTradeNetUsd: Number(state.kalshi.tradeNet.toFixed(4)),
      cumulativePaperNetUsd: Number(state.kalshi.totalNet.toFixed(4)),
      maxDrawdownUsd: Number(state.kalshi.maxDrawdown.toFixed(4)),
      tradeIntervals: state.kalshi.tradeIntervals,
      tradeIntervalsWithPossibleFill:
        state.kalshi.tradeIntervalsWithPossibleFill,
      topPersistentMarkets: state.kalshi.tickers,
    },
    radar: state.radar,
    scheduler: state.scheduler,
    errors: state.errors,
  };
}
