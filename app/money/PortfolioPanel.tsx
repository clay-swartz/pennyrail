"use client";
import { useEffect, useState } from "react";

function money(v: unknown) {
  const n = Number(v || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
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
  const jobState = mj.settledRevenueUsd > 0 ? "PAID" : mj.targetJobStatus || mj.bidStatus || (mj.targetOpen ? "OPEN" : "WATCHING");

  return <section style={{ margin: "28px auto 60px", maxWidth: 1180, padding: 22, border: "1px solid #b9b1a3", borderRadius: 18, background: "rgba(255,255,255,.34)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div><div style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", opacity: .65 }}>PennyRail Portfolio Engine v66 — Revenue Strike</div><h2 style={{ margin: "6px 0" }}>Outside money is the scoreboard</h2></div>
      <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, opacity: .65 }}>Progress to $1,000/day NET</div><strong style={{ fontSize: 28 }}>{Math.min(100, Number(m.progressTo1000Day || 0) * 100).toFixed(2)}%</strong></div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 16 }}>
      {[
        ["Outside revenue ~24h", money(m.actualOutside24hUsd)],
        ["Known cost ~24h", money(m.actualKnownCost24hUsd)],
        ["NET after recorded costs ~24h", money(m.actualNet24hUsd)],
        ["MoltJobs settled ~24h", money(m.moltJobsOutside24hUsd)],
        ["x402 outside ~24h", money(m.x402Outside24hUsd)],
        ["Outside payments", String(m.outsidePayments24h || 0)],
        ["Experiment spend today", `${money(b.spentTodayUsd)} / $1.00`],
        ["Experiment spend week", `${money(b.spentWeekUsd)} / $5.00`],
      ].map(([k,v]) => <div key={k} style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><div style={{ fontSize: 12, opacity: .65 }}>{k}</div><div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{v}</div></div>)}
    </div>

    <div style={{ marginTop: 14, padding: 16, border: "2px solid #8d8578", borderRadius: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>LIVE MONEY STRIKE — 5 USDC MoltJobs</strong><strong>{jobState}</strong></div>
      <div style={{ marginTop: 7 }}>Compile 40 agent-suitable tasks from public freelance boards</div>
      <div style={{ marginTop: 4, opacity: .75 }}>Credential: {mj.configured ? "configured" : "not configured"} · Open jobs seen: {mj.openJobs || 0} · Wallet: {money(mj.walletBalanceUsd)} · Settled from this rail: {money(mj.settledRevenueUsd)}</div>
      <div style={{ marginTop: 6 }}>{mj.lastAction || "Waiting for Revenue Strike tick."}</div>
      <div style={{ marginTop: 4, opacity: .7 }}>Next: {mj.nextAction || "Keep executing."}</div>
      {mj.error ? <div style={{ marginTop: 7, opacity: .78 }}>Blocker: {mj.error}</div> : null}
      <div style={{ marginTop: 7, fontSize: 12, opacity: .65 }}>Deliverable: {mj.deliverableUrl || "/api/revenue-deliverables/moltjobs-agent-tasks"} · Proof: {String(mj.proofHash || "").slice(0, 16)}…</div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginTop: 14 }}>
      <div style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><strong>Existing machine-commerce distribution</strong><div style={{ marginTop: 7 }}>Agent402/x402 hunter: {d.agent402Healthy == null ? "unknown" : d.agent402Healthy ? "healthy" : "needs attention"}</div><div style={{ marginTop: 6, opacity: .7 }}>{d.lastAction}</div></div>
      <div style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><strong>Additional funded work</strong><div style={{ marginTop: 7 }}>TaskBounty open: {demand.taskBountyOpen ?? "unavailable"}</div><div>BaseBounty observed: ~{demand.baseBountyOpenApprox || 0}</div><div style={{ marginTop: 6, opacity: .7 }}>{demand.taskBountyTop?.[0] ? `Top observed payout: ${money(demand.taskBountyTop[0].rewardUsd)} — ${demand.taskBountyTop[0].title}` : "Listeners stay on; no fake activity when inventory is empty."}</div></div>
      <div style={{ padding: 14, border: "1px solid #d5cec2", borderRadius: 12 }}><strong>Kalshi execution gate</strong><div style={{ marginTop: 7 }}>Live flag: {data.kalshiLive?.live ? "ON" : "OFF"}</div><div>Credentials: {data.kalshiLive?.configured ? "configured" : "not configured"}</div><div>Armed: {data.kalshiLive?.armed ? "YES" : "NO"}</div><div style={{ marginTop: 6, opacity: .7 }}>Corrected v64 paper economics remain separate from real money.</div></div>
    </div>

    <div style={{ marginTop: 10, fontSize: 12, opacity: .68 }}>Revenue is counted only when an outside payment is observed. MoltJobs counts actual incoming wallet transactions, not bids, assignments, submissions, or advertised bounty value.</div>
    <div style={{ marginTop: 16 }}><strong>Experiments</strong>{(data.experiments || []).map((e:any) => <div key={e.id} style={{ padding: "10px 0", borderBottom: "1px solid #ddd5c8" }}><b>{e.lane}</b> · {e.status} · {e.task}<div style={{ opacity: .68, marginTop: 3 }}>{e.lastAction} Next: {e.nextAction}</div></div>)}</div>
  </section>;
}
