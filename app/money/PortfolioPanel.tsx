"use client";
import { useEffect, useState } from "react";

function money(v: unknown) {
  const n = Number(v || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function wholeMoney(v: unknown) {
  const n = Number(v || 0);
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function PortfolioPanel() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/portfolio/status", { cache: "no-store", credentials: "same-origin" });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
        if (!stop) { setData(body?.state); setError(""); }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  if (error) return <section style={{ margin: "24px auto", maxWidth: 1180, padding: 20, border: "1px solid #b9b1a3", borderRadius: 16 }}><strong>Portfolio Engine</strong><div style={{ marginTop: 8 }}>Status unavailable: {error}</div></section>;
  if (!data) return <section style={{ margin: "24px auto", maxWidth: 1180, padding: 20 }}>Loading Portfolio Engine…</section>;

  const m = data.money || {}, b = data.budget || {}, d = data.distribution || {}, demand = data.demand || {}, mj = data.moltJobs || {};
  const scale = data.scale || {}, pm = scale.polymarket || {}, paper = scale.paper || {}, foundry = scale.foundry || {};
  const topPm = Array.isArray(pm.top) ? pm.top[0] : null;
  const experiments = Array.isArray(data.experiments) ? data.experiments : [];
  const batchRail = experiments.find((e:any) => e.id === "batchrail-bulk-inference") || null;

  return <section style={{ margin: "28px auto 60px", maxWidth: 1180, padding: 22, border: "1px solid #b9b1a3", borderRadius: 18, background: "rgba(255,255,255,.34)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div><div style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", opacity: .65 }}>PennyRail Portfolio Engine v68 — Corrected Scale Gate</div><h2 style={{ margin: "6px 0" }}>Only money paths with a credible $1K+/day ceiling get attention</h2></div>
      <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, opacity: .65 }}>Actual progress to $1,000/day NET</div><strong style={{ fontSize: 28 }}>{Math.min(100, Number(m.progressTo1000Day || 0) * 100).toFixed(2)}%</strong></div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 16 }}>
      {[
        ["Outside revenue ~24h", money(m.actualOutside24hUsd)],
        ["Known cost ~24h", money(m.actualKnownCost24hUsd)],
        ["NET after recorded costs ~24h", money(m.actualNet24hUsd)],
        ["Polymarket shared pools >=$1K/day", String(pm.programsAtLeast1000 || 0)],
        ["Largest measured reward pool/day", wholeMoney(pm.largestDailyizedPoolUsd)],
        ["Scale samples", String(scale.samples || 0)],
        ["Experiment spend today", `${money(b.spentTodayUsd)} / $1.00`],
        ["Experiment spend week", `${money(b.spentWeekUsd)} / $5.00`],
      ].map(([k,v]) => <div key={k} style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><div style={{ fontSize: 12, opacity: .65 }}>{k}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div></div>)}
    </div>

    <div style={{ marginTop: 14, padding: 16, border: "2px solid #72695c", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>SCALE LANE #1 — EXCHANGE-PAID INCENTIVES</strong><strong>{paper.screenPassed ? "SCALE SCREEN PASSED" : pm.ok ? "PAPER MEASURING" : "SCANNING"}</strong></div>
      <div style={{ marginTop: 7 }}>Polymarket US liquidity / volume / fill reward pools</div>
      <div style={{ marginTop: 5, opacity: .78 }}>Active markets: {pm.activeMarkets || 0} · Unique shared program periods: {pm.activeProgramPeriods || 0} · Corrected external pool capacity: {wholeMoney(pm.totalDailyizedRewardPoolUsd)}</div>
      {topPm ? <div style={{ marginTop: 7 }}>Top corrected program: <b>{topPm.programId || "program"}</b> · {wholeMoney(topPm.dailyPoolUsd)}/day shared across {Number(topPm.marketCount || 0).toLocaleString()} markets · target {Number(topPm.targetSize || 0).toLocaleString()} contracts · estimated capital for $1K gross/day {topPm.estimatedCapitalFor1000GrossUsd == null ? "—" : wholeMoney(topPm.estimatedCapitalFor1000GrossUsd)}</div> : null}
      {topPm?.grossPerSideUsdPerDay != null ? <div style={{ marginTop: 5, opacity: .75 }}>Equal-side program reward yardstick: {wholeMoney(topPm.grossPerSideUsdPerDay)}/day per side · sampled markets {Number(topPm.sampledMarkets || 0)}. This is screening capacity, not claimed profit or NET.</div> : null}
      <div style={{ marginTop: 7 }}>{paper.reason || "Accumulating public observations."}</div>
      <div style={{ marginTop: 5, opacity: .7 }}>Live credentials: {pm.configured ? "configured" : "not requested"} · Live flag: {pm.live ? "ON" : "OFF"} · Armed: {pm.armed ? "YES" : "NO"} · Capital cap: {wholeMoney(pm.maxCapitalUsd)}</div>
      {pm.error ? <div style={{ marginTop: 7, opacity: .78 }}>Scanner: {pm.error}</div> : null}
    </div>

    <div style={{ marginTop: 14, padding: 16, border: "2px solid #72695c", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>BATCHRAIL — LIVE MONEY PRODUCT</strong><strong>{batchRail ? "SELLING" : "STARTING"}</strong></div>
      <div style={{ marginTop: 7 }}>Bulk machine inference sold as one paid transaction instead of hundreds of individual paid calls.</div>
      <div style={{ marginTop: 6, opacity: .75 }}>{batchRail?.lastAction || "BatchRail economics are loading from the Portfolio Engine."}</div>
      <div style={{ marginTop: 6, opacity: .75 }}>{batchRail?.nextAction || "Only outside settlements count as revenue."}</div>
    </div>

    <div style={{ marginTop: 14, padding: 16, border: "1px solid #a69c8e", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>MONEY FOUNDRY</strong><strong>{foundry.primary || "scanning"}</strong></div>
      <div style={{ marginTop: 7 }}>The Foundry can invent a new product/platform or route existing supply. It rejects anything whose credible ceiling is too small.</div>
      <div style={{ marginTop: 6, opacity: .75 }}>Direct machine-commerce evidence: {Number(foundry.x402Services || 0).toLocaleString()} currently measured service surfaces · {Number(foundry.x402Samples24h || 0).toLocaleString()} settled-demand samples. Suspended 402radar is no longer a dependency.</div>
      {(foundry.lanes || []).map((lane:any) => <div key={lane.id} style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #ddd5c8" }}><b>{lane.id}</b> · {lane.status}<div style={{ opacity: .7, marginTop: 3 }}>{lane.measuredDemand}</div></div>)}
      {foundry.error ? <div style={{ marginTop: 7, opacity: .78 }}>Foundry scan: {foundry.error}</div> : null}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 14 }}>
      <div style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><strong>Existing machine-commerce distribution</strong><div style={{ marginTop: 7 }}>Agent402/x402 hunter: {d.agent402Healthy == null ? "unknown" : d.agent402Healthy ? "healthy" : "needs attention"}</div><div style={{ marginTop: 6, opacity: .7 }}>{d.lastAction}</div></div>
      <div style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><strong>Low-dollar work — background only</strong><div style={{ marginTop: 7 }}>MoltJobs: {mj.targetJobStatus || mj.bidStatus || (mj.targetOpen ? "OPEN" : "watching")} · settled {money(mj.settledRevenueUsd)}</div><div>TaskBounty open: {demand.taskBountyOpen ?? "unavailable"} · BaseBounty observed: ~{demand.baseBountyOpenApprox || 0}</div><div style={{ marginTop: 6, opacity: .7 }}>These may earn opportunistically but no longer consume setup time unless their measured ceiling changes materially.</div></div>
      <div style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><strong>Kalshi execution gate</strong><div style={{ marginTop: 7 }}>Live flag: {data.kalshiLive?.live ? "ON" : "OFF"}</div><div>Credentials: {data.kalshiLive?.configured ? "configured" : "not configured"}</div><div>Armed: {data.kalshiLive?.armed ? "YES" : "NO"}</div><div style={{ marginTop: 6, opacity: .7 }}>Corrected v64 paper economics continue; no real capital until the evidence gate clears.</div></div>
    </div>

    <div style={{ marginTop: 10, fontSize: 12, opacity: .68 }}>Revenue remains zero until an outside payment actually settles. Reward pools, bids, modeled P&amp;L and opportunity capacity are never counted as revenue.</div>
    <div style={{ marginTop: 16 }}><strong>Portfolio lanes</strong>{experiments.map((e:any) => <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #ddd5c8" }}><b>{e.lane}</b> · {e.status} · {e.task}<div style={{ opacity: .68, marginTop: 3 }}>{e.lastAction} Next: {e.nextAction}</div></div>)}</div>
  </section>;
}
