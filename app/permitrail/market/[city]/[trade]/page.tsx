import { notFound } from "next/navigation";
import { buildPermitRailFeed } from "@/lib/permitrail";
import { maskAddress, PERMITRAIL_CITIES, PERMITRAIL_TRADES, type PermitRailCity, type PermitRailTrade } from "@/lib/permitrail-core";
import { stripeConfigured } from "@/lib/permitrail-stripe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const cityLabels: Record<PermitRailCity, string> = { fortworth: "Fort Worth", arlington: "Arlington", dallas: "Dallas" };
function titleCase(value: string) { return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function money(value: number | null) { return value && value > 0 ? `$${Math.round(value).toLocaleString()}` : null; }

export async function generateMetadata({ params }: { params: Promise<{ city: string; trade: string }> }) {
  const { city, trade } = await params;
  if (!PERMITRAIL_CITIES.includes(city as PermitRailCity) || !PERMITRAIL_TRADES.includes(trade as PermitRailTrade)) return { title: "PermitRail" };
  return {
    title: `${cityLabels[city as PermitRailCity]} ${titleCase(trade)} Project Signals | PermitRail`,
    description: `Current public-record ${titleCase(trade).toLowerCase()} project signals for ${cityLabels[city as PermitRailCity]}, scored by recency, value and urgency.`,
  };
}

export default async function PermitRailMarketPage({ params }: { params: Promise<{ city: string; trade: string }> }) {
  const { city, trade } = await params;
  if (!PERMITRAIL_CITIES.includes(city as PermitRailCity) || !PERMITRAIL_TRADES.includes(trade as PermitRailTrade)) notFound();
  const c = city as PermitRailCity;
  const t = trade as PermitRailTrade;
  const feed = await buildPermitRailFeed({ city: c, trade: t, minScore: 35, maxAgeHours: 30 * 24, limit: 100 });
  const hot = feed.signals.filter(s => s.urgency === "hot").length;
  const warm = feed.signals.filter(s => s.urgency === "warm").length;
  const visible = feed.signals.slice(0, 6);
  const configured = stripeConfigured();

  return (
    <main style={{ minHeight: "100vh", background: "#f7f9fc", color: "#0f172a", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}><div style={{ maxWidth: 1080, margin: "0 auto", padding: "15px 24px", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}><a href="/permitrail" style={{ color: "#0f172a", textDecoration: "none", fontWeight: 850 }}>PermitRail</a><a href="/permitrail#pricing" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 750, fontSize: 13 }}>View all plans</a></div></header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "50px 24px 70px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 800 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "#22c55e", display: "inline-block" }} /> LIVE MARKET SAMPLE</div>
        <h1 style={{ fontSize: "clamp(38px,6vw,58px)", lineHeight: 1, letterSpacing: "-.045em", margin: "16px 0 14px", maxWidth: 850 }}>{cityLabels[c]} {titleCase(t)} opportunities PermitRail is tracking now.</h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "#475569", maxWidth: 790 }}>This is a live slice of PermitRail's public-record intelligence for your market—not a purchased lead list. Signals are scored for recency, urgency and trade fit, with the underlying public source preserved for verification.</p>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, margin: "28px 0 36px" }}>
          {[["Matching signals", feed.count], ["High priority", hot], ["Warm", warm], ["Sources online", feed.sourceHealth.filter(s => s.ok).length]].map(([label, value]) => <div key={String(label)} style={{ border: "1px solid #dbe3ee", borderRadius: 14, padding: 18, background: "#ffffff" }}><div style={{ fontSize: 31, fontWeight: 900, letterSpacing: "-.03em" }}>{value}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{label}</div></div>)}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 22, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 12 }}><div><div style={{ color: "#2563eb", fontSize: 11, fontWeight: 850, letterSpacing: ".08em" }}>SAMPLE OPPORTUNITIES</div><h2 style={{ margin: "5px 0 0", fontSize: 27 }}>What the feed looks like</h2></div><div style={{ color: "#64748b", fontSize: 12 }}>Street numbers masked publicly</div></div>
            <div style={{ display: "grid", gap: 11 }}>
              {visible.length ? visible.map(signal => (
                <article key={signal.id} style={{ border: "1px solid #dbe3ee", borderRadius: 15, padding: 17, background: "#ffffff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><span style={{ display: "inline-block", padding: "4px 7px", borderRadius: 999, background: signal.urgency === "hot" ? "#fee2e2" : "#fef3c7", color: signal.urgency === "hot" ? "#991b1b" : "#92400e", fontSize: 10, fontWeight: 850 }}>{signal.urgency.toUpperCase()}</span><strong style={{ marginLeft: 8 }}>Score {signal.score}</strong></div>{money(signal.estimatedOpportunityValueUsd) ? <strong style={{ color: "#0f766e" }}>Est. project value {money(signal.estimatedOpportunityValueUsd)}</strong> : null}</div>
                  <div style={{ marginTop: 10, fontWeight: 750 }}>{maskAddress(signal.address) || "Location available in source record"}</div>
                  <div style={{ color: "#64748b", fontSize: 13, marginTop: 5, lineHeight: 1.45 }}>{signal.permitType || signal.description || "Public project record"}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 7 }}>{titleCase(signal.primaryTrade)}{signal.adjacentTrades?.length ? ` · also relevant to ${signal.adjacentTrades.slice(0, 3).map(titleCase).join(", ")}` : ""}</div>
                </article>
              )) : <div style={{ padding: 22, border: "1px dashed #cbd5e1", borderRadius: 15, background: "#ffffff", color: "#64748b" }}>No matching recent signals in this exact slice right now. PermitRail keeps refreshing automatically.</div>}
            </div>
          </div>

          <aside style={{ position: "sticky", top: 20, border: "1px solid #cfe0ff", borderRadius: 18, padding: 22, background: "#eef5ff" }}>
            <div style={{ color: "#1d4ed8", fontSize: 11, fontWeight: 850, letterSpacing: ".08em" }}>THIS MARKET + TRADE</div>
            <h2 style={{ fontSize: 26, margin: "7px 0 9px", letterSpacing: "-.025em" }}>Get the full feed automatically.</h2>
            <p style={{ color: "#475569", lineHeight: 1.55, fontSize: 14 }}>Starter covers {cityLabels[c]} + {titleCase(t)} for $299/month. Access starts immediately after Stripe checkout.</p>
            <ul style={{ paddingLeft: 18, color: "#334155", fontSize: 13, lineHeight: 1.8 }}><li>Up to 100 scored signals per request</li><li>JSON and CSV access</li><li>Source evidence preserved</li><li>Automatic refresh</li></ul>
            <form action="/api/permitrail/checkout" method="post"><input type="hidden" name="plan" value="starter" /><input type="hidden" name="city" value={c} /><input type="hidden" name="trade" value={t} /><button disabled={!configured} style={{ width: "100%", padding: "13px 14px", borderRadius: 10, border: 0, fontWeight: 850, cursor: configured ? "pointer" : "not-allowed", background: configured ? "#2563eb" : "#94a3b8", color: "white" }}>{configured ? "Start this feed — $299/mo" : "Checkout unavailable"}</button></form>
            <div style={{ marginTop: 10, color: "#64748b", fontSize: 11, textAlign: "center" }}>Secure checkout by Stripe</div>
          </aside>
        </section>

        <div style={{ marginTop: 42, paddingTop: 20, borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: 12, lineHeight: 1.55 }}>Current coverage varies by jurisdiction. PermitRail is independent public-record intelligence and is not affiliated with source jurisdictions. Public records can contain errors or delays; verify source records before acting.</div>
      </div>
    </main>
  );
}
