type AnyObj = Record<string, any>;

const KALSHI = "https://external-api.kalshi.com/trade-api/v2";
const POLY_INCENTIVES = "https://api.prod.polymarketexchange.com/v1/incentives";
const POLY_MARKETS = "https://gateway.polymarket.us";
const INDEX_402 = "https://402index.io/api/v1/opportunities?protocol=x402";

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(s: unknown) {
  return String(s ?? "").replace(/\s+/g, " ").trim();
}

function kalshiRewardUsd(raw: unknown) {
  // Kalshi's incentive `period_reward` is centi-cents:
  // 1 unit = $0.0001. Example: 10,000,000 => $1,000.
  return n(raw) / 10_000;
}

function periodDays(start: unknown, end: unknown) {
  const s = start ? Date.parse(String(start)) : NaN;
  const e = end ? Date.parse(String(end)) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  return (e - s) / 86_400_000;
}

function rewardPerDay(rewardUsd: number, start: unknown, end: unknown) {
  const days = periodDays(start, end);
  return days ? rewardUsd / days : null;
}

function rewardShareScenarios(maxPerDay: number | null) {
  if (maxPerDay == null || !Number.isFinite(maxPerDay)) return null;
  return {
    at1PctShare: maxPerDay * 0.01,
    at5PctShare: maxPerDay * 0.05,
    at10PctShare: maxPerDay * 0.10,
    at25PctShare: maxPerDay * 0.25,
    at50PctShare: maxPerDay * 0.50,
  };
}

async function json(url: string, timeoutMs = 12000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json", "user-agent": "PennyRail-Money-Radar/1.0" },
      signal: controller.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status} ${text.slice(0,300)}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTitle(value: unknown) {
  return clean(value)
    .toLowerCase()
    .replace(/\b(will|does|do|is|are|the|a|an|to|of|on|in|by|before|after|at|for|from)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(value.split(" ").filter(x => x.length > 1));
}

function jaccard(a: string, b: string) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const x of A) if (B.has(x)) both++;
  return both / (A.size + B.size - both);
}

function activeNow(start: unknown, end: unknown) {
  const now = Date.now();
  const s = start ? Date.parse(String(start)) : -Infinity;
  const e = end ? Date.parse(String(end)) : Infinity;
  return (Number.isNaN(s) || s <= now) && (Number.isNaN(e) || e >= now);
}

async function polymarketIncentives() {
  const first = await json(`${POLY_INCENTIVES}?statuses=active&pageSize=500&orderBy=created_at&orderDirection=desc`);
  const programs = Array.isArray(first?.programs) ? first.programs : [];

  const rows: AnyObj[] = [];
  const uniquePeriods = new Map<string, {
    key: string;
    programId: string;
    period: string;
    start: unknown;
    end: unknown;
    rewardPoolUsd: number;
    marketCount: number;
  }>();

  for (const p of programs) {
    const periods = Array.isArray(p?.timePeriods) ? p.timePeriods : [];
    for (const period of periods) {
      if (String(period?.status || "").toLowerCase() !== "active" && !activeNow(period?.start, period?.end)) continue;

      const reward = n(period?.rewardPool);
      const target = n(period?.targetSize);
      const programId = clean(period?.programId);
      const key = [
        programId,
        clean(period?.period),
        String(period?.start ?? ""),
        String(period?.end ?? ""),
        String(reward),
      ].join("|");

      const existing = uniquePeriods.get(key);
      if (existing) {
        existing.marketCount += 1;
      } else {
        uniquePeriods.set(key, {
          key,
          programId,
          period: clean(period?.period),
          start: period?.start ?? null,
          end: period?.end ?? null,
          rewardPoolUsd: reward,
          marketCount: 1,
        });
      }

      rows.push({
        venue: "Polymarket US",
        marketSlug: clean(p?.marketSlug),
        programId,
        programType: clean(period?.programType),
        period: clean(period?.period),
        start: period?.start ?? null,
        end: period?.end ?? null,
        rewardPoolUsd: reward,
        discountFactor: n(period?.discountFactor, 1),
        targetSize: target,
        // IMPORTANT: rewardPool is shared across a program/time-period's markets.
        // This per-market row does NOT own the whole pool.
        sharedPoolKey: key,
        rewardPoolSharedAcrossProgram: true,
      });
    }
  }

  const marketCounts = new Map<string, number>();
  for (const [key, period] of uniquePeriods) marketCounts.set(key, period.marketCount);

  for (const row of rows) {
    const count = marketCounts.get(row.sharedPoolKey) || 1;
    row.programMarketCount = count;
    row.equalSharePoolPerMarketUsd = row.rewardPoolUsd / count;
    const days = periodDays(row.start, row.end);
    row.periodDays = days;
    row.equalSharePoolPerMarketPerDayUsd = days ? row.equalSharePoolPerMarketUsd / days : null;
  }

  rows.sort((a,b) =>
    n(b.equalSharePoolPerMarketPerDayUsd) - n(a.equalSharePoolPerMarketPerDayUsd) ||
    n(b.equalSharePoolPerMarketUsd) - n(a.equalSharePoolPerMarketUsd)
  );

  const top = rows.slice(0, 20);
  const marketData = await Promise.all(top.map(async row => {
    try {
      const payload = await json(`${POLY_MARKETS}/v1/markets/${encodeURIComponent(row.marketSlug)}/bbo`, 7000);
      const m = payload?.marketData || {};
      const bid = n(m?.bestBid?.value, NaN);
      const ask = n(m?.bestAsk?.value, NaN);
      const spread = Number.isFinite(bid) && Number.isFinite(ask)
        ? Number((ask - bid).toFixed(4))
        : null;
      const target = n(row.targetSize);

      // For a binary market, NO bid is approximately 1 - YES ask.
      // If we alone posted target size on both sides at current BBO, this is
      // the rough maximum collateral footprint. This is NOT a recommendation.
      const twoSidedCapitalAtBbo =
        target > 0 && Number.isFinite(bid) && Number.isFinite(ask)
          ? target * (bid + (1 - ask))
          : null;

      return {
        ...row,
        bestBid: Number.isFinite(bid) ? bid : null,
        bestAsk: Number.isFinite(ask) ? ask : null,
        spread,
        openInterest: m?.openInterest ?? null,
        sharesTraded: m?.sharesTraded ?? null,
        estimatedTwoSidedCapitalAtTargetBboUsd: twoSidedCapitalAtBbo,
        rewardScenariosUsdPerDay: rewardShareScenarios(row.equalSharePoolPerMarketPerDayUsd),
      };
    } catch (error) {
      return { ...row, marketDataError: error instanceof Error ? error.message : String(error) };
    }
  }));

  const unique = [...uniquePeriods.values()];
  const totalUniqueActiveRewardPoolUsd = unique.reduce((s, r) => s + n(r.rewardPoolUsd), 0);

  return {
    activeMarketPeriods: rows.length,
    uniqueActiveProgramPeriods: unique.length,
    totalUniqueActiveRewardPoolUsd,
    accountingNote:
      "Polymarket rewardPool is a program/time-period pool shared across markets. totalUniqueActiveRewardPoolUsd dedupes repeated market rows by program/time period.",
    top: marketData,
  };
}

async function kalshiIncentives() {
  const payload = await json(`${KALSHI}/incentive_programs?status=active&type=all&limit=10000`);
  const raw = Array.isArray(payload?.incentive_programs) ? payload.incentive_programs : [];

  const rows = raw.map((p:any) => {
    const reward = kalshiRewardUsd(p?.period_reward);
    const target = n(p?.target_size_fp);
    const days = periodDays(p?.start_date, p?.end_date);
    const perDay = days ? reward / days : null;

    return {
      venue: "Kalshi",
      id: clean(p?.id),
      marketTicker: clean(p?.market_ticker),
      incentiveType: clean(p?.incentive_type),
      description: clean(p?.incentive_description),
      start: p?.start_date ?? null,
      end: p?.end_date ?? null,
      rawPeriodRewardCentiCents: n(p?.period_reward),
      rewardPoolUsd: reward,
      periodDays: days,
      maxRewardUsdPerDayIfFullyPaid: perDay,
      discountFactor: n(p?.discount_factor_bps) / 10000,
      targetSize: target,
      rewardPerTargetContractForWholePeriod: target > 0 ? reward / target : null,
      rewardScenariosUsdPerDay: rewardShareScenarios(perDay),
    };
  }).sort((a:any,b:any) =>
    n(b.maxRewardUsdPerDayIfFullyPaid) - n(a.maxRewardUsdPerDayIfFullyPaid) ||
    n(b.rewardPoolUsd) - n(a.rewardPoolUsd)
  );

  const top = rows.slice(0, 30);
  const enriched = await Promise.all(top.map(async (row:any) => {
    if (!row.marketTicker) return row;
    try {
      const m = (await json(`${KALSHI}/markets/${encodeURIComponent(row.marketTicker)}`, 7000))?.market || {};
      const yesBid = n(m?.yes_bid_dollars, NaN);
      const yesAsk = n(m?.yes_ask_dollars, NaN);
      const noBid = n(m?.no_bid_dollars, NaN);
      const noAsk = n(m?.no_ask_dollars, NaN);
      const target = n(row.targetSize);

      // Rough collateral footprint if we alone supplied target-size BUY liquidity
      // on both sides at the current best bids. Actual scoring is pro-rata and
      // depends on all competing resting liquidity every second.
      const twoSidedCapital =
        target > 0 && Number.isFinite(yesBid) && Number.isFinite(noBid)
          ? target * (yesBid + noBid)
          : null;

      const maxPerDay = row.maxRewardUsdPerDayIfFullyPaid;
      return {
        ...row,
        title: clean(m?.title),
        yesBid: Number.isFinite(yesBid) ? yesBid : null,
        yesAsk: Number.isFinite(yesAsk) ? yesAsk : null,
        noBid: Number.isFinite(noBid) ? noBid : null,
        noAsk: Number.isFinite(noAsk) ? noAsk : null,
        volume24h: n(m?.volume_24h_fp),
        openInterest: n(m?.open_interest_fp),
        liquidityUsd: n(m?.liquidity_dollars),
        estimatedTwoSidedCapitalAtTargetBidsUsd: twoSidedCapital,
        fullPoolDailyRewardToCapitalCeiling:
          twoSidedCapital && maxPerDay != null ? maxPerDay / twoSidedCapital : null,
        rulesPrimary: clean(m?.rules_primary).slice(0,1200),
        rulesSecondary: clean(m?.rules_secondary).slice(0,1200),
      };
    } catch (error) {
      return { ...row, marketDataError: error instanceof Error ? error.message : String(error) };
    }
  }));

  const totalActivePeriodRewardUsd = rows.reduce((s:any,r:any)=>s+n(r.rewardPoolUsd),0);
  const totalMaxRewardUsdPerDay = rows.reduce((s:any,r:any)=>s+n(r.maxRewardUsdPerDayIfFullyPaid),0);

  return {
    activePrograms: rows.length,
    totalActivePeriodRewardUsd,
    totalMaxRewardUsdPerDay,
    theoreticalShareOfAllActiveDailyRewardsNeededFor1000:
      totalMaxRewardUsdPerDay > 0 ? 1000 / totalMaxRewardUsdPerDay : null,
    accountingNote:
      "Kalshi period_reward is centi-cents (1 unit = $0.0001), not dollars. maxRewardUsdPerDayIfFullyPaid divides each time-period reward by its scheduled duration; actual payout is pro-rata by snapshot score and can be lower when snapshots are excluded.",
    top: enriched,
  };
}

async function kalshiOpenMarkets(limit = 300) {
  const payload = await json(`${KALSHI}/markets?status=open&limit=${limit}`);
  return Array.isArray(payload?.markets) ? payload.markets : [];
}

async function polymarketOpenMarkets(limit = 300) {
  const payload = await json(`${POLY_MARKETS}/v1/markets?limit=${limit}`);
  if (Array.isArray(payload?.markets)) return payload.markets;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

async function predictionArbitrage() {
  const [kMarkets, pMarkets] = await Promise.all([
    kalshiOpenMarkets(300).catch(()=>[]),
    polymarketOpenMarkets(300).catch(()=>[]),
  ]);

  const K = kMarkets.map((m:any) => ({
    ticker: clean(m?.ticker),
    title: clean(m?.title || m?.subtitle),
    norm: normalizeTitle(m?.title || m?.subtitle),
    yesBid: n(m?.yes_bid_dollars, NaN),
    yesAsk: n(m?.yes_ask_dollars, NaN),
    closeTime: m?.close_time ?? null,
  })).filter((m:any)=>m.norm && Number.isFinite(m.yesBid) && Number.isFinite(m.yesAsk));

  const P = pMarkets.map((m:any) => ({
    slug: clean(m?.slug || m?.marketSlug),
    title: clean(m?.question || m?.title || m?.subtitle),
    norm: normalizeTitle(m?.question || m?.title || m?.subtitle),
    yesBid: n(m?.bestBid ?? m?.best_bid ?? m?.bestBidPrice, NaN),
    yesAsk: n(m?.bestAsk ?? m?.best_ask ?? m?.bestAskPrice, NaN),
    endDate: m?.endDate ?? m?.end_date ?? null,
  })).filter((m:any)=>m.norm && Number.isFinite(m.yesBid) && Number.isFinite(m.yesAsk));

  const candidates: AnyObj[] = [];
  for (const k of K) {
    let best:any = null;
    for (const p of P) {
      const sim = jaccard(k.norm, p.norm);
      if (sim < 0.82) continue;
      if (!best || sim > best.similarity) best = {p, similarity:sim};
    }
    if (!best) continue;

    const p = best.p;
    // Guaranteed binary-pair gross edges before fees:
    // buy K YES + buy P NO (= 1 - P YES bid)
    const edgeKYesPNo = 1 - (k.yesAsk + (1 - p.yesBid));
    // buy P YES + buy K NO (= 1 - K YES bid)
    const edgePYesKNo = 1 - (p.yesAsk + (1 - k.yesBid));
    const gross = Math.max(edgeKYesPNo, edgePYesKNo);

    if (gross >= 0.015) {
      candidates.push({
        kalshi: { ticker:k.ticker, title:k.title, yesBid:k.yesBid, yesAsk:k.yesAsk },
        polymarket: { slug:p.slug, title:p.title, yesBid:p.yesBid, yesAsk:p.yesAsk },
        similarity: Number(best.similarity.toFixed(3)),
        grossEdgeUsdPerPair: Number(gross.toFixed(4)),
        direction: edgeKYesPNo >= edgePYesKNo ? "BUY_KALSHI_YES_BUY_POLY_NO" : "BUY_POLY_YES_BUY_KALSHI_NO",
        note: "Paper candidate only. Verify identical settlement language, depth and fees before any live trade.",
      });
    }
  }

  return candidates.sort((a,b)=>b.grossEdgeUsdPerPair-a.grossEdgeUsdPerPair).slice(0,25);
}

async function kalshiBountyCandidates() {
  const markets = await kalshiOpenMarkets(1000).catch(()=>[]);
  const candidates: AnyObj[] = [];
  const placeholder = /\{\{[^}]+\}\}|<[^>]+>|TBD|TODO|undefined|null/i;

  for (const m of markets) {
    const fields = {
      title: clean(m?.title),
      subtitle: clean(m?.subtitle),
      yesSubTitle: clean(m?.yes_sub_title),
      noSubTitle: clean(m?.no_sub_title),
      rulesPrimary: clean(m?.rules_primary),
      rulesSecondary: clean(m?.rules_secondary),
    };
    const bad = Object.entries(fields).filter(([,value]) => value && placeholder.test(value));
    if (bad.length) {
      candidates.push({
        ticker: clean(m?.ticker),
        title: fields.title,
        issue: "possible broken variable / placeholder",
        fields: bad.map(([key,value])=>({field:key, sample:value.slice(0,250)})),
        bountyContext: "Kalshi market bug bounty pays $25-$1,000+ at its discretion; first valid private report wins.",
      });
    }
  }
  return candidates.slice(0,50);
}

async function x402Opportunities() {
  try {
    return await json(INDEX_402, 9000);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function topUnified(poly:any, kalshi:any, arbs:any[]) {
  const rows:any[] = [];

  for (const r of poly?.top || []) {
    const daily = n(r.equalSharePoolPerMarketPerDayUsd);
    const capital = n(r.estimatedTwoSidedCapitalAtTargetBboUsd);
    rows.push({
      lane: "POLYMARKET_LIQUIDITY_REWARD",
      id: r.marketSlug,
      headlineUsdPerDay: daily || null,
      estimatedCapitalAtTargetUsd: capital || null,
      score:
        (capital > 0 ? daily / capital : 0) * 1000 +
        Math.log10(1 + Math.max(0, daily)) * 10,
      details: r,
    });
  }

  for (const r of kalshi?.top || []) {
    const daily = n(r.maxRewardUsdPerDayIfFullyPaid);
    const capital = n(r.estimatedTwoSidedCapitalAtTargetBidsUsd);
    rows.push({
      lane: r.incentiveType === "liquidity" ? "KALSHI_LIQUIDITY_REWARD" : "KALSHI_VOLUME_REWARD",
      id: r.marketTicker,
      headlineUsdPerDay: daily || null,
      estimatedCapitalAtTargetUsd: capital || null,
      score:
        (capital > 0 ? daily / capital : 0) * 1000 +
        Math.log10(1 + Math.max(0, daily)) * 10,
      details: r,
    });
  }

  for (const r of arbs || []) {
    rows.push({
      lane: "CROSS_VENUE_ARBITRAGE",
      id: `${r.kalshi?.ticker || ""} ↔ ${r.polymarket?.slug || ""}`,
      headlineUsdPerDay: null,
      estimatedCapitalAtTargetUsd: null,
      score: n(r.grossEdgeUsdPerPair) * 1000 + n(r.similarity)*10,
      details: r,
    });
  }

  return rows.sort((a,b)=>b.score-a.score).slice(0,30);
}

export async function runMoneyRadar() {
  const startedAt = new Date().toISOString();

  const [polymarket, kalshi, x402] = await Promise.all([
    polymarketIncentives().catch(error=>({
      error:error instanceof Error?error.message:String(error),
      activeMarketPeriods:0,
      uniqueActiveProgramPeriods:0,
      totalUniqueActiveRewardPoolUsd:0,
      accountingNote:"Polymarket incentive scan failed; using zeroed fallback.",
      top:[],
    })),
    kalshiIncentives().catch(error=>({
      error:error instanceof Error?error.message:String(error),
      activePrograms:0,
      totalActivePeriodRewardUsd:0,
      totalMaxRewardUsdPerDay:0,
      theoreticalShareOfAllActiveDailyRewardsNeededFor1000:null,
      accountingNote:"Kalshi incentive scan failed; using zeroed fallback.",
      top:[],
    })),
    x402Opportunities(),
  ]);

  const [arbitrage, bountyCandidates] = await Promise.all([
    predictionArbitrage().catch(()=>[]),
    kalshiBountyCandidates().catch(()=>[]),
  ]);

  const unified = topUnified(polymarket, kalshi, arbitrage);

  const kalshiDailyCeiling = n(kalshi?.totalMaxRewardUsdPerDay);
  const polyUniqueActivePool = n(polymarket?.totalUniqueActiveRewardPoolUsd);

  return {
    ok: true,
    startedAt,
    generatedAt: new Date().toISOString(),
    targetUsdPerDay: 1000,
    decision: {
      primary:
        kalshiDailyCeiling > 0
          ? "KALSHI_LIQUIDITY_REWARD_PAPER_MODEL"
          : "POLYMARKET_US_LIQUIDITY_REWARD_PAPER_MODEL",
      secondary: "CROSS_VENUE_ARBITRAGE",
      noCapitalLane: "PENNYRAIL_X402_GAP_ARBITRAGE",
      rule:
        "Do not infer earnings from headline reward pools. Rank by corrected reward-per-day, estimated collateral footprint, competing liquidity, fills, fees and adverse selection. No live capital until paper results stay positive.",
    },
    rewardInventory: {
      polymarket,
      kalshi,
      correctedSummary: {
        kalshiMaxScheduledRewardUsdPerDayAcrossActivePrograms: kalshiDailyCeiling,
        polymarketUniqueActiveProgramPeriodPoolUsd: polyUniqueActivePool,
        warning:
          "Kalshi daily figure is a payout ceiling before pro-rata competition/excluded snapshots. Polymarket figure is deduped active pool, not a daily earnings estimate.",
      },
    },
    crossVenueArbitrage: {
      candidates: arbitrage,
      count: arbitrage.length,
      minimumGrossEdgeIncluded: 0.015,
    },
    kalshiBugBounty: {
      candidates: bountyCandidates,
      count: bountyCandidates.length,
      note: "Scanner only flags obvious machine-detectable anomalies; never exploit a bug. Report privately through Kalshi's official bounty process.",
    },
    x402GapFeed: x402,
    topUnifiedOpportunities: unified,
    next:
      "Use corrected daily economics to select a small paper portfolio. PennyRail/x402 gaps continue in parallel. Do not fund trading until the paper model demonstrates a credible path to $1,000/day net.",
  };
}
