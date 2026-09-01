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
  for (const p of programs) {
    const periods = Array.isArray(p?.timePeriods) ? p.timePeriods : [];
    for (const period of periods) {
      if (String(period?.status || "").toLowerCase() !== "active" && !activeNow(period?.start, period?.end)) continue;
      const reward = n(period?.rewardPool);
      const target = n(period?.targetSize);
      rows.push({
        venue: "Polymarket US",
        marketSlug: clean(p?.marketSlug),
        programId: clean(period?.programId),
        programType: clean(period?.programType),
        period: clean(period?.period),
        start: period?.start ?? null,
        end: period?.end ?? null,
        rewardPoolUsd: reward,
        discountFactor: n(period?.discountFactor, 1),
        targetSize: target,
        rewardPerTargetContract: target > 0 ? reward / target : null,
        shareNeededFor1000: reward > 0 ? 1000 / reward : null,
      });
    }
  }

  rows.sort((a,b) =>
    n(b.rewardPoolUsd) - n(a.rewardPoolUsd) ||
    n(b.rewardPerTargetContract) - n(a.rewardPerTargetContract)
  );

  const top = rows.slice(0, 20);
  const marketData = await Promise.all(top.map(async row => {
    try {
      const payload = await json(`${POLY_MARKETS}/v1/markets/${encodeURIComponent(row.marketSlug)}/bbo`, 7000);
      const m = payload?.marketData || {};
      const bid = n(m?.bestBid?.value, NaN);
      const ask = n(m?.bestAsk?.value, NaN);
      return {
        ...row,
        bestBid: Number.isFinite(bid) ? bid : null,
        bestAsk: Number.isFinite(ask) ? ask : null,
        spread: Number.isFinite(bid) && Number.isFinite(ask) ? ask - bid : null,
        openInterest: m?.openInterest ?? null,
        sharesTraded: m?.sharesTraded ?? null,
      };
    } catch (error) {
      return { ...row, marketDataError: error instanceof Error ? error.message : String(error) };
    }
  }));

  return {
    activePeriods: rows.length,
    totalActiveRewardPoolUsd: rows.reduce((s,r)=>s+n(r.rewardPoolUsd),0),
    shareOfCurrentPoolsNeededFor1000: rows.reduce((s,r)=>s+n(r.rewardPoolUsd),0) > 0
      ? 1000 / rows.reduce((s,r)=>s+n(r.rewardPoolUsd),0)
      : null,
    top: marketData,
  };
}

async function kalshiIncentives() {
  const payload = await json(`${KALSHI}/incentive_programs?status=active&type=all&limit=10000`);
  const raw = Array.isArray(payload?.incentive_programs) ? payload.incentive_programs : [];

  const rows = raw.map((p:any) => {
    const reward = n(p?.period_reward);
    const target = n(p?.target_size_fp);
    return {
      venue: "Kalshi",
      id: clean(p?.id),
      marketTicker: clean(p?.market_ticker),
      incentiveType: clean(p?.incentive_type),
      description: clean(p?.incentive_description),
      start: p?.start_date ?? null,
      end: p?.end_date ?? null,
      rewardPoolUsd: reward,
      discountFactor: n(p?.discount_factor_bps) / 10000,
      targetSize: target,
      rewardPerTargetContract: target > 0 ? reward / target : null,
      shareNeededFor1000: reward > 0 ? 1000 / reward : null,
    };
  }).sort((a:any,b:any) =>
    n(b.rewardPoolUsd) - n(a.rewardPoolUsd) ||
    n(b.rewardPerTargetContract) - n(a.rewardPerTargetContract)
  );

  const top = rows.slice(0, 20);
  const enriched = await Promise.all(top.map(async (row:any) => {
    if (!row.marketTicker) return row;
    try {
      const m = (await json(`${KALSHI}/markets/${encodeURIComponent(row.marketTicker)}`, 7000))?.market || {};
      return {
        ...row,
        title: clean(m?.title),
        yesBid: n(m?.yes_bid_dollars, NaN),
        yesAsk: n(m?.yes_ask_dollars, NaN),
        noBid: n(m?.no_bid_dollars, NaN),
        noAsk: n(m?.no_ask_dollars, NaN),
        volume24h: n(m?.volume_24h_fp),
        openInterest: n(m?.open_interest_fp),
        liquidityUsd: n(m?.liquidity_dollars),
        rulesPrimary: clean(m?.rules_primary).slice(0,1200),
        rulesSecondary: clean(m?.rules_secondary).slice(0,1200),
      };
    } catch (error) {
      return { ...row, marketDataError: error instanceof Error ? error.message : String(error) };
    }
  }));

  return {
    activePrograms: rows.length,
    totalActiveRewardPoolUsd: rows.reduce((s:any,r:any)=>s+n(r.rewardPoolUsd),0),
    shareOfCurrentPoolsNeededFor1000: rows.reduce((s:any,r:any)=>s+n(r.rewardPoolUsd),0) > 0
      ? 1000 / rows.reduce((s:any,r:any)=>s+n(r.rewardPoolUsd),0)
      : null,
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
    rows.push({
      lane: "POLYMARKET_LIQUIDITY_REWARD",
      id: r.marketSlug,
      headlineUsd: n(r.rewardPoolUsd),
      score: n(r.rewardPerTargetContract) * 100 + Math.log10(1+n(r.rewardPoolUsd))*10,
      details: r,
    });
  }
  for (const r of kalshi?.top || []) {
    rows.push({
      lane: "KALSHI_INCENTIVE",
      id: r.marketTicker,
      headlineUsd: n(r.rewardPoolUsd),
      score: n(r.rewardPerTargetContract) * 100 + Math.log10(1+n(r.rewardPoolUsd))*10,
      details: r,
    });
  }
  for (const r of arbs || []) {
    rows.push({
      lane: "CROSS_VENUE_ARBITRAGE",
      id: `${r.kalshi?.ticker || ""} ↔ ${r.polymarket?.slug || ""}`,
      headlineUsd: n(r.grossEdgeUsdPerPair),
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
      activePeriods:0,
      totalActiveRewardPoolUsd:0,
      shareOfCurrentPoolsNeededFor1000:null,
      top:[],
    })),
    kalshiIncentives().catch(error=>({
      error:error instanceof Error?error.message:String(error),
      activePrograms:0,
      totalActiveRewardPoolUsd:0,
      shareOfCurrentPoolsNeededFor1000:null,
      top:[],
    })),
    x402Opportunities(),
  ]);

  const [arbitrage, bountyCandidates] = await Promise.all([
    predictionArbitrage().catch(()=>[]),
    kalshiBountyCandidates().catch(()=>[]),
  ]);

  const unified = topUnified(polymarket, kalshi, arbitrage);

  const polyPool = n(polymarket?.totalActiveRewardPoolUsd);
  const kalshiPool = n(kalshi?.totalActiveRewardPoolUsd);

  return {
    ok: true,
    startedAt,
    generatedAt: new Date().toISOString(),
    targetUsdPerDay: 1000,
    decision: {
      primary:
        polyPool >= kalshiPool
          ? "POLYMARKET_US_LIQUIDITY_REWARD_FARMING"
          : "KALSHI_LIQUIDITY_REWARD_FARMING",
      secondary: "CROSS_VENUE_ARBITRAGE",
      noCapitalLane: "PENNYRAIL_X402_GAP_ARBITRAGE",
      rule:
        "Paper/simulate first. Only enable live capital after repeatable positive expected NET yield under conservative fill, fee and adverse-selection assumptions.",
    },
    rewardInventory: {
      polymarket,
      kalshi,
      combinedActiveRewardPoolUsd: polyPool + kalshiPool,
      theoreticalShareOfCombinedCurrentPoolsFor1000: polyPool + kalshiPool > 0 ? 1000/(polyPool+kalshiPool) : null,
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
      "Use this output to build the live/paper market-making worker around the highest reward-to-risk lane. PennyRail continues running unchanged in parallel.",
  };
}
