type AnyObj = Record<string, any>;

const KALSHI = "https://external-api.kalshi.com/trade-api/v2";

type Level = {
  price: number;
  count: number;
  ours: boolean;
  ourCount: number;
};

type Incentive = {
  id: string;
  marketTicker: string;
  start: string | null;
  end: string | null;
  rewardPoolUsd: number;
  targetSize: number;
  discountFactor: number;
  durationMinutes: number | null;
};

type MarketSnapshot = {
  ticker: string;
  title: string;
  yesBid: number | null;
  yesAsk: number | null;
  noBid: number | null;
  noAsk: number | null;
  volume24h: number;
  openInterest: number;
  spread: number | null;
};

type Scenario = {
  sizePctTarget: number;
  orderSize: number;
  yesPrice: number | null;
  noPrice: number | null;
  bothSidesQualify: boolean;
  bothOrdersScore: boolean;
  yesScoreShare: number;
  noScoreShare: number;
  estimatedPoolShare: number;
  estimatedRewardThisPeriodUsd: number;
  continuousRunRateUsdPerDay: number | null;
  estimatedCapitalUsd: number | null;
  rewardToCapitalThisPeriod: number | null;
  pairedFillLockedEdgeUsdBeforeFees: number | null;
  maxOneSidedLossUsd: number | null;
};

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function kalshiRewardUsd(raw: unknown): number {
  return num(raw) / 10_000;
}

function durationMinutes(start: unknown, end: unknown): number | null {
  const s = start ? Date.parse(String(start)) : NaN;
  const e = end ? Date.parse(String(end)) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return (e - s) / 60_000;
}

async function fetchJson(url: string, timeoutMs = 10000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "PennyRail-Kalshi-Paper/1.0",
      },
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Kalshi HTTP ${response.status}: ${body.slice(0, 240)}`);
    }
    return body ? JSON.parse(body) : null;
  } finally {
    clearTimeout(timer);
  }
}

function activeNow(start: string | null, end: string | null): boolean {
  const now = Date.now();
  const s = start ? Date.parse(start) : -Infinity;
  const e = end ? Date.parse(end) : Infinity;
  return (!Number.isFinite(s) || s <= now) && (!Number.isFinite(e) || e >= now);
}

async function activeLiquidityIncentives(): Promise<Incentive[]> {
  const payload = await fetchJson(
    `${KALSHI}/incentive_programs?status=active&type=liquidity&limit=10000`,
    12000,
  );
  const rows: any[] = Array.isArray(payload?.incentive_programs)
    ? payload.incentive_programs
    : [];

  return rows
    .map((row: any): Incentive => ({
      id: text(row?.id),
      marketTicker: text(row?.market_ticker),
      start: row?.start_date ? String(row.start_date) : null,
      end: row?.end_date ? String(row.end_date) : null,
      rewardPoolUsd: kalshiRewardUsd(row?.period_reward),
      targetSize: num(row?.target_size_fp),
      discountFactor: Math.min(1, Math.max(0, num(row?.discount_factor_bps) / 10000)),
      durationMinutes: durationMinutes(row?.start_date, row?.end_date),
    }))
    .filter((row: Incentive): boolean =>
      Boolean(row.marketTicker) &&
      row.rewardPoolUsd > 0 &&
      row.targetSize > 0 &&
      activeNow(row.start, row.end)
    );
}

async function marketSnapshot(ticker: string): Promise<MarketSnapshot> {
  const payload = await fetchJson(`${KALSHI}/markets/${encodeURIComponent(ticker)}`, 7000);
  const m = payload?.market || {};
  const yesBid = Number.isFinite(Number(m?.yes_bid_dollars)) ? Number(m.yes_bid_dollars) : null;
  const yesAsk = Number.isFinite(Number(m?.yes_ask_dollars)) ? Number(m.yes_ask_dollars) : null;
  const noBid = Number.isFinite(Number(m?.no_bid_dollars)) ? Number(m.no_bid_dollars) : null;
  const noAsk = Number.isFinite(Number(m?.no_ask_dollars)) ? Number(m.no_ask_dollars) : null;

  return {
    ticker,
    title: text(m?.title),
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    volume24h: num(m?.volume_24h_fp),
    openInterest: num(m?.open_interest_fp),
    spread:
      yesBid != null && yesAsk != null
        ? Number(Math.max(0, yesAsk - yesBid).toFixed(4))
        : null,
  };
}

function parseLevels(raw: unknown): Array<{ price: number; count: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row: unknown): { price: number; count: number } | null => {
      if (!Array.isArray(row) || row.length < 2) return null;
      const price = Number(row[0]);
      const count = Number(row[1]);
      if (!Number.isFinite(price) || !Number.isFinite(count) || count <= 0) return null;
      return { price, count };
    })
    .filter((row): row is { price: number; count: number } => row != null)
    .sort((a, b) => b.price - a.price);
}

async function orderbook(ticker: string): Promise<{
  yes: Array<{ price: number; count: number }>;
  no: Array<{ price: number; count: number }>;
}> {
  const payload = await fetchJson(
    `${KALSHI}/markets/${encodeURIComponent(ticker)}/orderbook?depth=100`,
    7000,
  );
  const book = payload?.orderbook_fp || {};
  return {
    yes: parseLevels(book?.yes_dollars),
    no: parseLevels(book?.no_dollars),
  };
}

function inferredTick(levels: Array<{ price: number; count: number }>): number {
  const unique = [...new Set(levels.map(level => level.price))].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < unique.length; i++) {
    const diff = unique[i] - unique[i - 1];
    if (diff > 0 && diff < min) min = diff;
  }
  if (!Number.isFinite(min)) return 0.01;
  return Math.max(0.0001, Math.min(0.01, min));
}

function addOurOrder(
  levels: Array<{ price: number; count: number }>,
  price: number,
  count: number,
): Level[] {
  const grouped = new Map<number, { count: number; ourCount: number }>();

  for (const level of levels) {
    const current = grouped.get(level.price) || { count: 0, ourCount: 0 };
    current.count += level.count;
    grouped.set(level.price, current);
  }

  const current = grouped.get(price) || { count: 0, ourCount: 0 };
  current.count += count;
  current.ourCount += count;
  grouped.set(price, current);

  return [...grouped.entries()]
    .map(([levelPrice, level]) => ({
      price: levelPrice,
      count: level.count,
      ours: level.ourCount > 0,
      ourCount: level.ourCount,
    }))
    .sort((a, b) => b.price - a.price);
}

function sideScore(
  levels: Array<{ price: number; count: number }>,
  targetSize: number,
  discountFactor: number,
  ourPrice: number,
  ourCount: number,
): {
  qualifies: boolean;
  referencePrice: number | null;
  ourShare: number;
  totalDepth: number;
  qualifyingDepth: number;
} {
  // Public order books aggregate all resting quantity at the same price. Merge
  // our hypothetical order into that price level before applying the target
  // cutoff. Treating the aggregate row as FIFO ahead of us incorrectly forces
  // our score to zero whenever the target boundary lands inside that row.
  const withUs = addOurOrder(levels, ourPrice, ourCount);
  const totalDepth = withUs.reduce((sum, level) => sum + level.count, 0);
  if (totalDepth < targetSize) {
    return {
      qualifies: false,
      referencePrice: null,
      ourShare: 0,
      totalDepth,
      qualifyingDepth: totalDepth,
    };
  }

  const refThreshold = targetSize / 5;
  let cumulative = 0;
  let referencePrice: number | null = null;

  for (const level of withUs) {
    cumulative += level.count;
    if (cumulative >= refThreshold) {
      referencePrice = level.price;
      break;
    }
  }

  if (referencePrice == null) {
    return {
      qualifies: false,
      referencePrice: null,
      ourShare: 0,
      totalDepth,
      qualifyingDepth: 0,
    };
  }

  const tick = inferredTick(levels);
  cumulative = 0;
  let totalRaw = 0;
  let ourRaw = 0;

  for (const level of withUs) {
    if (cumulative >= targetSize) break;

    const remaining = targetSize - cumulative;
    const included = Math.min(level.count, remaining);
    const includedFraction = level.count > 0 ? included / level.count : 0;
    const ticksAway =
      level.price >= referencePrice
        ? 0
        : Math.max(0, Math.round((referencePrice - level.price) / tick));
    const multiplier = ticksAway === 0 ? 1 : Math.pow(discountFactor, ticksAway);
    const raw = included * multiplier;

    totalRaw += raw;
    if (level.ours) {
      ourRaw += level.ourCount * includedFraction * multiplier;
    }
    cumulative += included;
  }

  return {
    qualifies: cumulative >= targetSize,
    referencePrice,
    ourShare: totalRaw > 0 ? ourRaw / totalRaw : 0,
    totalDepth,
    qualifyingDepth: cumulative,
  };
}

function chooseQuotePrice(
  levels: Array<{ price: number; count: number }>,
  fallback: number | null,
): number | null {
  if (levels.length) return levels[0].price;
  return fallback;
}

function simulateScenario(args: {
  incentive: Incentive;
  market: MarketSnapshot;
  yesLevels: Array<{ price: number; count: number }>;
  noLevels: Array<{ price: number; count: number }>;
  sizePctTarget: number;
}): Scenario {
  const { incentive, market, yesLevels, noLevels, sizePctTarget } = args;
  const orderSize = Math.max(1, incentive.targetSize * sizePctTarget);
  const yesPrice = chooseQuotePrice(yesLevels, market.yesBid);
  const noPrice = chooseQuotePrice(noLevels, market.noBid);

  if (yesPrice == null || noPrice == null) {
    return {
      sizePctTarget,
      orderSize,
      yesPrice,
      noPrice,
      bothSidesQualify: false,
      bothOrdersScore: false,
      yesScoreShare: 0,
      noScoreShare: 0,
      estimatedPoolShare: 0,
      estimatedRewardThisPeriodUsd: 0,
      continuousRunRateUsdPerDay: null,
      estimatedCapitalUsd: null,
      rewardToCapitalThisPeriod: null,
      pairedFillLockedEdgeUsdBeforeFees: null,
      maxOneSidedLossUsd: null,
    };
  }

  const yes = sideScore(
    yesLevels,
    incentive.targetSize,
    incentive.discountFactor,
    yesPrice,
    orderSize,
  );
  const no = sideScore(
    noLevels,
    incentive.targetSize,
    incentive.discountFactor,
    noPrice,
    orderSize,
  );

  const bothSidesQualify = yes.qualifies && no.qualifies;
  const bothOrdersScore = yes.ourShare > 0 && no.ourShare > 0;
  // Kalshi's snapshot score is our normalized share on YES plus our normalized
  // share on NO. The system-wide total is 2 when both sides qualify, so divide
  // by two for our approximate pool share at this snapshot.
  const estimatedPoolShare = bothSidesQualify
    ? Math.max(0, Math.min(1, (yes.ourShare + no.ourShare) / 2))
    : 0;

  const estimatedRewardThisPeriodUsd =
    incentive.rewardPoolUsd * estimatedPoolShare;
  const continuousRunRateUsdPerDay =
    incentive.durationMinutes && incentive.durationMinutes > 0
      ? estimatedRewardThisPeriodUsd * (1440 / incentive.durationMinutes)
      : null;
  const estimatedCapitalUsd = orderSize * (yesPrice + noPrice);
  const rewardToCapitalThisPeriod =
    estimatedCapitalUsd > 0
      ? estimatedRewardThisPeriodUsd / estimatedCapitalUsd
      : null;
  const pairedFillLockedEdgeUsdBeforeFees =
    orderSize * Math.max(0, 1 - yesPrice - noPrice);
  const maxOneSidedLossUsd =
    orderSize * Math.max(yesPrice, noPrice);

  return {
    sizePctTarget,
    orderSize,
    yesPrice,
    noPrice,
    bothSidesQualify,
    bothOrdersScore,
    yesScoreShare: yes.ourShare,
    noScoreShare: no.ourShare,
    estimatedPoolShare,
    estimatedRewardThisPeriodUsd,
    continuousRunRateUsdPerDay,
    estimatedCapitalUsd,
    rewardToCapitalThisPeriod,
    pairedFillLockedEdgeUsdBeforeFees,
    maxOneSidedLossUsd,
  };
}

function attractiveness(
  market: MarketSnapshot,
  scenario: Scenario,
): number {
  const runRate = scenario.continuousRunRateUsdPerDay || 0;
  const capital = scenario.estimatedCapitalUsd || Infinity;
  const spreadPenalty =
    market.spread == null ? 25 : Math.max(0, market.spread - 0.03) * 600;
  const illiquidityPenalty =
    market.volume24h <= 0 ? 100 :
    market.volume24h < 100 ? 50 :
    market.volume24h < 1000 ? 20 : 0;
  const oneSidedRiskPenalty =
    scenario.maxOneSidedLossUsd != null && scenario.maxOneSidedLossUsd > 0
      ? Math.min(40, scenario.maxOneSidedLossUsd / 25)
      : 0;

  return (
    (capital > 0 && Number.isFinite(capital) ? (runRate / capital) * 100 : 0) +
    Math.log10(1 + Math.max(0, market.volume24h)) * 8 -
    spreadPenalty -
    illiquidityPenalty -
    oneSidedRiskPenalty
  );
}

async function candidateRows(limit = 24): Promise<Array<{
  incentive: Incentive;
  market: MarketSnapshot;
}>> {
  const incentives = await activeLiquidityIncentives();

  const ranked = incentives
    .filter((row: Incentive): boolean =>
      row.durationMinutes != null &&
      row.durationMinutes > 0 &&
      row.durationMinutes <= 180 &&
      row.rewardPoolUsd >= 1 &&
      row.targetSize >= 100 &&
      row.targetSize <= 5000
    )
    .sort((a: Incentive, b: Incentive): number => {
      const aRate = a.durationMinutes ? a.rewardPoolUsd / a.durationMinutes : 0;
      const bRate = b.durationMinutes ? b.rewardPoolUsd / b.durationMinutes : 0;
      return bRate - aRate;
    })
    .slice(0, Math.max(limit * 3, 40));

  const withMarkets = await Promise.all(
    ranked.map(async (incentive: Incentive) => {
      try {
        return {
          incentive,
          market: await marketSnapshot(incentive.marketTicker),
        };
      } catch {
        return null;
      }
    }),
  );

  return withMarkets
    .filter((row): row is { incentive: Incentive; market: MarketSnapshot } => row != null)
    .sort((a, b) => {
      // Prefer markets where fills are observable and spread is not enormous.
      const av = a.market.volume24h;
      const bv = b.market.volume24h;
      const as = a.market.spread ?? 1;
      const bs = b.market.spread ?? 1;
      const ar = a.incentive.durationMinutes
        ? a.incentive.rewardPoolUsd / a.incentive.durationMinutes
        : 0;
      const br = b.incentive.durationMinutes
        ? b.incentive.rewardPoolUsd / b.incentive.durationMinutes
        : 0;
      return (
        (br * Math.log10(1 + bv) / Math.max(0.01, bs)) -
        (ar * Math.log10(1 + av) / Math.max(0.01, as))
      );
    })
    .slice(0, limit);
}

export async function runKalshiPaperModel(): Promise<AnyObj> {
  const candidates = await candidateRows(20);
  const sizeScenarios = [0.05, 0.10, 0.25, 0.50, 1.00];

  const evaluated = await Promise.all(
    candidates.map(async ({ incentive, market }) => {
      try {
        const book = await orderbook(incentive.marketTicker);
        const scenarios = sizeScenarios.map((sizePctTarget: number) =>
          simulateScenario({
            incentive,
            market,
            yesLevels: book.yes,
            noLevels: book.no,
            sizePctTarget,
          }),
        );

        // Use 25% of target as the default comparison point: large enough to
        // matter, but not assuming we dominate the book.
        const baseline =
          scenarios.find((scenario: Scenario) => scenario.sizePctTarget === 0.25)
          || scenarios[0];

        return {
          ticker: incentive.marketTicker,
          title: market.title,
          rewardPeriod: {
            rewardPoolUsd: incentive.rewardPoolUsd,
            durationMinutes: incentive.durationMinutes,
            targetSize: incentive.targetSize,
            discountFactor: incentive.discountFactor,
            start: incentive.start,
            end: incentive.end,
          },
          market: {
            yesBid: market.yesBid,
            yesAsk: market.yesAsk,
            noBid: market.noBid,
            noAsk: market.noAsk,
            spread: market.spread,
            volume24h: market.volume24h,
            openInterest: market.openInterest,
            yesBookDepth: book.yes.reduce((sum, level) => sum + level.count, 0),
            noBookDepth: book.no.reduce((sum, level) => sum + level.count, 0),
          },
          scenarios,
          baseline25PctTarget: baseline,
          score: attractiveness(market, baseline),
          riskFlags: [
            ...(market.spread != null && market.spread > 0.05 ? ["WIDE_SPREAD"] : []),
            ...(market.volume24h < 100 ? ["LOW_VOLUME"] : []),
            ...(!baseline.bothSidesQualify ? ["WOULD_NOT_QUALIFY_NOW"] : []),
            ...(baseline.bothSidesQualify && !baseline.bothOrdersScore
              ? ["ONE_ORDER_DOES_NOT_SCORE"]
              : []),
            ...(baseline.maxOneSidedLossUsd != null &&
              baseline.estimatedRewardThisPeriodUsd > 0 &&
              baseline.maxOneSidedLossUsd >
                baseline.estimatedRewardThisPeriodUsd * 20
              ? ["ONE_SIDED_FILL_RISK_DOMINATES_REWARD"] : []),
          ],
        };
      } catch (error) {
        return {
          ticker: incentive.marketTicker,
          title: market.title,
          error: error instanceof Error ? error.message : String(error),
          score: -9999,
        };
      }
    }),
  );

  const ranked = evaluated.sort(
    (a: AnyObj, b: AnyObj): number => num(b?.score, -9999) - num(a?.score, -9999),
  );

  const investablePaper = ranked.filter((row: AnyObj): boolean => {
    const baseline = row?.baseline25PctTarget;
    const flags: string[] = Array.isArray(row?.riskFlags) ? row.riskFlags : [];
    const observable =
      row?.market?.volume24h >= 50 || row?.market?.openInterest >= 1000;
    return Boolean(
      baseline?.bothSidesQualify &&
      baseline?.bothOrdersScore &&
      baseline?.continuousRunRateUsdPerDay > 0 &&
      row?.market?.spread != null &&
      row.market.spread <= 0.05 &&
      observable &&
      !flags.includes("ONE_ORDER_DOES_NOT_SCORE") &&
      !flags.includes("ONE_SIDED_FILL_RISK_DOMINATES_REWARD"),
    );
  });

  const topPortfolio = investablePaper.slice(0, 8);
  const portfolioRunRateUsdPerDay = topPortfolio.reduce(
    (sum: number, row: AnyObj) =>
      sum + num(row?.baseline25PctTarget?.continuousRunRateUsdPerDay),
    0,
  );
  const simultaneousCapitalUsd = topPortfolio.reduce(
    (sum: number, row: AnyObj) =>
      sum + num(row?.baseline25PctTarget?.estimatedCapitalUsd),
    0,
  );

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    targetUsdPerDay: 1000,
    model: "Kalshi liquidity reward snapshot paper model",
    methodology: {
      source: "public Kalshi active incentive definitions + public market/orderbook data",
      quotePolicy:
        "Hypothetical post-only liquidity joins the current best YES and NO bids. No real orders are placed.",
      scoring:
        "Approximates Kalshi's current liquidity incentive formula: reference depth at target/5, price-level proportional treatment at the target boundary, distance discount, normalized score share on both sides, then pool-share estimate.",
      portfolioGate:
        "At 25% of target, both sides must qualify, both hypothetical orders must score, spread must be at most $0.05, recent volume must be at least 50 contracts or open interest at least 1,000, and one-sided loss cannot exceed period reward by more than 20x.",
      caveat:
        "This is a single live snapshot, not a realized earnings forecast. Actual rewards depend on every one-second snapshot, competing order changes, excluded snapshots, fills, maker fees, adverse selection and program continuity.",
    },
    gate: {
      targetReachedOnCurrent25PctSnapshotRunRate:
        portfolioRunRateUsdPerDay >= 1000,
      paperPortfolioRunRateUsdPerDay: portfolioRunRateUsdPerDay,
      estimatedSimultaneousCapitalUsd: simultaneousCapitalUsd,
      marketCount: topPortfolio.length,
      grossOnly: true,
      nextAction:
        portfolioRunRateUsdPerDay >= 1000
          ? "BUILD_PERSISTENT_24H_PAPER_WORKER"
          : "DO_NOT_FUND_YET_KEEP_SEARCHING",
    },
    topPaperPortfolio: topPortfolio,
    rankedCandidates: ranked,
    note:
      "No credentials, no trading and no capital are used by this endpoint. A live-money worker should not be enabled from one snapshot even if the run-rate exceeds $1,000/day.",
  };
}
