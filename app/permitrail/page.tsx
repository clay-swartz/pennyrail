import { PERMITRAIL_PLANS, stripeConfigured } from "@/lib/permitrail-stripe";
import { PERMITRAIL_CITIES, PERMITRAIL_TRADES } from "@/lib/permitrail-core";

export const dynamic = "force-dynamic";

const cityLabels: Record<string, string> = {
  fortworth: "Fort Worth",
  arlington: "Arlington",
  dallas: "Dallas (ROW + distress signals)",
};

function titleCase(value: string) {
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function PermitRailPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const configured = stripeConfigured();
  void searchParams;
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 24px 80px", fontFamily: "system-ui, sans-serif", color: "#191713" }}>
      <section style={{ maxWidth: 760, marginBottom: 42 }}>
        <p style={{ letterSpacing: 1.4, textTransform: "uppercase", fontSize: 12, fontWeight: 700 }}>PennyRail / PermitRail</p>
        <h1 style={{ fontSize: 52, lineHeight: 1.02, margin: "12px 0 18px" }}>Know which construction projects to chase before the market gets noisy.</h1>
        <p style={{ fontSize: 20, lineHeight: 1.55, color: "#5a554c" }}>
          PermitRail turns fresh public project records into scored contractor opportunities: the project, the trade that should act, downstream trades, urgency, value, and source evidence.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          <a href="/api/permitrail/sample" style={{ padding: "12px 18px", borderRadius: 999, background: "#191713", color: "white", textDecoration: "none", fontWeight: 700 }}>See a live sample</a>
          <a href="/api/permitrail/status" style={{ padding: "12px 18px", borderRadius: 999, border: "1px solid #cfc8bb", color: "#191713", textDecoration: "none", fontWeight: 700 }}>Live system status</a>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18, marginBottom: 48 }}>
        {Object.values(PERMITRAIL_PLANS).map(plan => (
          <article key={plan.id} style={{ border: "1px solid #d8d1c5", borderRadius: 20, padding: 24, background: "#faf7f0" }}>
            <h2 style={{ marginTop: 0 }}>{plan.name}</h2>
            <div style={{ fontSize: 38, fontWeight: 800 }}>${plan.monthlyUsd}<span style={{ fontSize: 15, fontWeight: 500 }}>/mo</span></div>
            <p style={{ minHeight: 68, color: "#625d54", lineHeight: 1.5 }}>{plan.description}</p>
            <p style={{ fontSize: 14 }}><strong>{plan.maxSignalsPerRequest}</strong> scored signals per API request</p>
            <form action="/api/permitrail/checkout" method="post" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="plan" value={plan.id} />
              <label style={{ fontSize: 13, fontWeight: 700 }}>Primary market</label>
              <select name="city" defaultValue={plan.cityScope === "single" ? "fortworth" : "all"} style={{ padding: 10, borderRadius: 10, border: "1px solid #cfc8bb" }}>
                {plan.cityScope === "all" ? <option value="all">All supported DFW markets</option> : null}
                {PERMITRAIL_CITIES.map(city => <option value={city} key={city}>{cityLabels[city] || titleCase(city)}</option>)}
              </select>
              <label style={{ fontSize: 13, fontWeight: 700 }}>Primary trade</label>
              <select name="trade" defaultValue={plan.tradeScope === "single" ? "general-contractor" : "all"} style={{ padding: 10, borderRadius: 10, border: "1px solid #cfc8bb" }}>
                {plan.tradeScope === "all" ? <option value="all">All trades</option> : null}
                {PERMITRAIL_TRADES.map(trade => <option value={trade} key={trade}>{titleCase(trade)}</option>)}
              </select>
              <button disabled={!configured} style={{ marginTop: 8, padding: 12, border: 0, borderRadius: 12, fontWeight: 800, background: configured ? "#191713" : "#bdb7ad", color: "white", cursor: configured ? "pointer" : "not-allowed" }}>
                {configured ? `Start ${plan.name}` : "Checkout activates when Stripe is connected"}
              </button>
            </form>
          </article>
        ))}
      </section>

      <section style={{ marginBottom: 46 }}>
        <h2>Live market pages</h2>
        <p style={{ color: "#625d54", lineHeight: 1.55, maxWidth: 720 }}>Browse continuously refreshed samples by market and trade. These same pages are used by PermitRail's acquisition engine to show contractors concrete demand before asking them to subscribe.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            ["fortworth", "electrical"], ["fortworth", "hvac"], ["arlington", "electrical"],
            ["arlington", "hvac"], ["dallas", "restoration"], ["dallas", "excavation"],
          ].map(([city, trade]) => <a key={`${city}:${trade}`} href={`/permitrail/market/${city}/${trade}`} style={{ padding: "10px 14px", borderRadius: 999, border: "1px solid #cfc8bb", color: "#191713", textDecoration: "none", fontWeight: 700 }}>{cityLabels[city] || titleCase(city)} · {titleCase(trade)}</a>)}
        </div>
      </section>

      <section style={{ borderTop: "1px solid #ddd5c8", paddingTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 24 }}>
        <div><h3>What it watches</h3><p style={{ color: "#625d54", lineHeight: 1.55 }}>Live Fort Worth development permits, Arlington issued permits, Dallas right-of-way permits, and fresh Dallas municipal distress signals. New jurisdictions can plug into the same normalizer.</p></div>
        <div><h3>What it adds</h3><p style={{ color: "#625d54", lineHeight: 1.55 }}>Trade inference, adjacent-trade opportunity mapping, recency scoring, project-value weighting, urgency, deduplication and source evidence.</p></div>
        <div><h3>How you use it</h3><p style={{ color: "#625d54", lineHeight: 1.55 }}>JSON or CSV through a subscriber feed. Machine buyers can also buy one-off x402 feeds; RapidAPI support is built in and activates with one provider secret.</p></div>
      </section>
      <p style={{ marginTop: 48, fontSize: 12, color: "#777067" }}>PermitRail is independent public-record intelligence and is not affiliated with the source jurisdictions. Public records can contain errors or delays; verify before acting. · <a href="/permitrail/terms">Terms</a> · <a href="/permitrail/privacy">Privacy</a></p>
    </main>
  );
}
