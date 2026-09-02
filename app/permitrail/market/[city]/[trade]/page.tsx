import { notFound } from "next/navigation";
import { buildPermitRailFeed } from "@/lib/permitrail";
import { maskAddress, PERMITRAIL_CITIES, PERMITRAIL_TRADES, type PermitRailCity, type PermitRailTrade } from "@/lib/permitrail-core";
import { stripeConfigured } from "@/lib/permitrail-stripe";

export const dynamic = "force-dynamic";

const cityLabels: Record<PermitRailCity, string> = { fortworth: "Fort Worth", arlington: "Arlington", dallas: "Dallas" };
function titleCase(value: string) { return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }

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
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "50px 24px 80px", fontFamily: "system-ui, sans-serif", color: "#191713" }}>
      <a href="/permitrail" style={{ color: "#625d54", textDecoration: "none", fontWeight: 700 }}>← PermitRail</a>
      <p style={{ letterSpacing: 1.3, textTransform: "uppercase", fontSize: 12, fontWeight: 800, marginTop: 30 }}>Live market sample</p>
      <h1 style={{ fontSize: 48, lineHeight: 1.05, margin: "10px 0 14px" }}>{cityLabels[c]} {titleCase(t)} project intelligence</h1>
      <p style={{ fontSize: 19, lineHeight: 1.55, color: "#5f594f", maxWidth: 760 }}>PermitRail currently sees <strong>{feed.count}</strong> matching public-record project signals in this market, including <strong>{hot} high-priority</strong> and <strong>{warm} warm</strong> opportunities. This page refreshes from the same live feed sold through PermitRail.</p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, margin: "28px 0" }}>
        {[ ["Current signals", feed.count], ["High priority", hot], ["Warm", warm], ["Sources online", feed.sourceHealth.filter(s => s.ok).length] ].map(([label, value]) => (
          <div key={String(label)} style={{ border: "1px solid #d8d1c5", borderRadius: 16, padding: 18, background: "#faf7f0" }}><div style={{ fontSize: 30, fontWeight: 800 }}>{value}</div><div style={{ color: "#686157", fontSize: 13 }}>{label}</div></div>
        ))}
      </section>

      <section style={{ marginTop: 34 }}>
        <h2>Sample opportunities</h2>
        <p style={{ color: "#686157" }}>Street numbers are masked on this public sample. Paid feeds include the project fields available from the cited public record.</p>
        <div style={{ display: "grid", gap: 12 }}>
          {visible.length ? visible.map(signal => (
            <article key={signal.id} style={{ border: "1px solid #ddd5c8", borderRadius: 16, padding: 18 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}><strong>{signal.urgency.toUpperCase()} · score {signal.score}</strong><span style={{ color: "#6b655c" }}>{titleCase(signal.primaryTrade)}</span></div>
              <div style={{ marginTop: 8 }}>{maskAddress(signal.address) || "Location available in source record"}</div>
              <div style={{ color: "#6b655c", fontSize: 14, marginTop: 6 }}>{signal.permitType || signal.description || "Public project record"}{signal.estimatedOpportunityValueUsd ? ` · est. project value $${Math.round(signal.estimatedOpportunityValueUsd).toLocaleString()}` : ""}</div>
            </article>
          )) : <div style={{ padding: 20, border: "1px dashed #cfc8bb", borderRadius: 16 }}>No matching recent signals in this slice right now. PermitRail keeps refreshing automatically.</div>}
        </div>
      </section>

      <section style={{ marginTop: 42, padding: 28, borderRadius: 20, background: "#191713", color: "white" }}>
        <h2 style={{ marginTop: 0 }}>Get the full feed automatically</h2>
        <p style={{ lineHeight: 1.55, color: "#eee8dc" }}>Starter is $299/month for one market + one trade. Growth expands one trade across DFW. Operator unlocks all supported markets and trades.</p>
        <form action="/api/permitrail/checkout" method="post">
          <input type="hidden" name="plan" value="starter" /><input type="hidden" name="city" value={c} /><input type="hidden" name="trade" value={t} />
          <button disabled={!configured} style={{ padding: "12px 18px", borderRadius: 999, border: 0, fontWeight: 800, cursor: configured ? "pointer" : "not-allowed" }}>{configured ? "Start this market — $299/mo" : "Checkout unavailable"}</button>
        </form>
      </section>
      <p style={{ marginTop: 34, fontSize: 12, color: "#777067" }}>Public-record intelligence. Verify source records before acting. PermitRail is independent and not affiliated with the source jurisdictions.</p>
    </main>
  );
}
