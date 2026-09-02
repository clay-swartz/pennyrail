"use client";
import { useEffect, useState } from "react";

function money(value: unknown) {
  const n = Number(value || 0);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function time(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function MoneyNowPanel() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/money/now", { cache: "no-store", credentials: "same-origin" });
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
        if (!stop) { setData(body); setError(""); }
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const id = window.setInterval(load, 10_000);
    return () => { stop = true; window.clearInterval(id); };
  }, []);

  if (error || !data) return null;
  const live = data.live24h || {};
  const durable = data.durable || {};
  const rails = data.rails || {};
  const hasMoney = Number(live.grossUsd || 0) > 0 || Number(durable.allTimeOutsideUsd || 0) > 0;

  return (
    <section style={{ maxWidth: 1180, margin: "20px auto 0", padding: "0 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ borderRadius: 18, border: `2px solid ${hasMoney ? "#16a34a" : "#d97706"}`, background: "#ffffff", color: "#0f172a", overflow: "hidden", boxShadow: "0 12px 34px rgba(15,23,42,.08)" }}>
        <div style={{ padding: "14px 18px", background: hasMoney ? "#f0fdf4" : "#fffbeb", display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div><div style={{ fontSize: 11, letterSpacing: ".09em", fontWeight: 850, color: hasMoney ? "#166534" : "#92400e" }}>MONEY NOW · DIRECT RECONCILIATION</div><div style={{ fontSize: 22, fontWeight: 900, marginTop: 3 }}>{hasMoney ? "Outside money has landed." : "Outside revenue is still $0."}</div></div>
          <div style={{ fontSize: 12, color: "#64748b" }}>refreshes every 10 seconds · {time(data.generatedAt)}</div>
        </div>
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {[
            ["Gross outside · 24h", money(live.grossUsd)],
            ["Known costs · 24h", money(live.knownCostUsd)],
            ["NET · 24h", money(live.netUsd)],
            ["Outside payments · 24h", String(live.paymentCount || 0)],
            ["All-time outside", money(durable.allTimeOutsideUsd)],
            ["All-time NET", money(durable.allTimeNetUsd)],
          ].map(([label, value]) => <div key={label} style={{ padding: 13, border: "1px solid #e2e8f0", borderRadius: 12 }}><div style={{ fontSize: 11, color: "#64748b" }}>{label}</div><div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{value}</div></div>)}
        </div>
        <div style={{ padding: "0 18px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          <div style={{ padding: 13, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}><strong>Stripe / PermitRail</strong><div style={{ marginTop: 5, color: "#475569", fontSize: 13 }}>{money(rails?.stripe?.grossUsd)} gross · {money(rails?.stripe?.knownNetUsd)} known net</div></div>
          <div style={{ padding: 13, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}><strong>Base USDC / x402</strong><div style={{ marginTop: 5, color: "#475569", fontSize: 13 }}>{money(rails?.x402?.grossUsd)} · {rails?.x402?.paymentCount || 0} outside payments</div></div>
          <div style={{ padding: 13, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}><strong>RapidAPI</strong><div style={{ marginTop: 5, color: "#475569", fontSize: 13 }}>Marketplace earnings: RapidAPI Studio → Analytics → Revenue Analytics / Monetize → Transactions</div></div>
        </div>
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "12px 18px", color: "#64748b", fontSize: 12 }}>First outside payment: <strong style={{ color: "#334155" }}>{durable.firstDollarAt ? `${time(durable.firstDollarAt)} via ${durable.firstDollarSource || "outside payment"}` : "not yet"}</strong>. Direct Stripe and Base-USDC checks do not wait for the hourly Portfolio reconciliation.</div>
      </div>
    </section>
  );
}
