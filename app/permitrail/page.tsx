import { PERMITRAIL_PLANS, stripeConfigured } from "@/lib/permitrail-stripe";
import { PERMITRAIL_CITIES, PERMITRAIL_TRADES } from "@/lib/permitrail-core";
import { loadPermitRailState } from "@/lib/permitrail";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "PermitRail — DFW Project Intelligence for Contractors",
  description: "Fresh public permit and project records, scored by trade, urgency and opportunity so DFW contractors know what to chase next.",
};

const cityLabels: Record<string, string> = {
  fortworth: "Fort Worth",
  arlington: "Arlington",
  dallas: "Dallas",
};

function titleCase(value: string) {
  return value.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function dollar(value: number | null | undefined) {
  return value && value > 0 ? `$${Math.round(value).toLocaleString()}` : "—";
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "12px 13px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
};

const labelStyle = { fontSize: 12, fontWeight: 750, color: "#334155", marginBottom: 6 };

export default async function PermitRailPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : {};
  const checkoutErrorRaw = params?.checkout_error;
  const checkoutError = Array.isArray(checkoutErrorRaw) ? checkoutErrorRaw[0] : checkoutErrorRaw;
  const configured = stripeConfigured();
  const state = await loadPermitRailState().catch(() => null);
  const top = Array.isArray(state?.top) ? state!.top.slice(0, 3) : [];
  const onlineSources = Array.isArray(state?.sourceHealth) ? state!.sourceHealth.filter(row => row.ok).length : 0;

  return (
    <main style={{ minHeight: "100vh", background: "#f7f9fc", color: "#0f172a", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" }}>
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 24px", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <a href="/permitrail" style={{ textDecoration: "none", color: "#0f172a", fontWeight: 850, fontSize: 19, letterSpacing: "-.02em" }}>PermitRail</a>
          <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
            <a href="#how" style={{ color: "#475569", textDecoration: "none" }}>How it works</a>
            <a href="#pricing" style={{ color: "#475569", textDecoration: "none" }}>Pricing</a>
            <a href="/permitrail/market/fortworth/electrical" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 750 }}>See live opportunities</a>
          </div>
        </div>
      </header>

      {checkoutError ? <div style={{ maxWidth: 1180, margin: "18px auto 0", padding: "0 24px" }}><div style={{ padding: "12px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: 13 }}><strong>Checkout could not start.</strong> {String(checkoutError)}</div></div> : null}

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px 44px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 42, alignItems: "center" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 999, background: "#eaf2ff", color: "#1d4ed8", fontWeight: 750, fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "#22c55e", display: "inline-block" }} />
            DFW project intelligence · refreshed automatically
          </div>
          <h1 style={{ fontSize: "clamp(42px,6vw,68px)", lineHeight: .98, letterSpacing: "-.045em", margin: "20px 0 20px", maxWidth: 760 }}>
            Find the projects worth chasing before your competitors do.
          </h1>
          <p style={{ fontSize: 20, lineHeight: 1.55, color: "#475569", maxWidth: 700, margin: 0 }}>
            PermitRail watches public permit and project records across DFW, scores the work by trade, urgency and likely value, and gives you a clean feed of the opportunities that fit your business.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <a href="#pricing" style={{ padding: "13px 18px", borderRadius: 10, background: "#2563eb", color: "white", textDecoration: "none", fontWeight: 800, boxShadow: "0 8px 20px rgba(37,99,235,.18)" }}>Choose your coverage</a>
            <a href="/permitrail/market/fortworth/electrical" style={{ padding: "13px 18px", borderRadius: 10, background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", textDecoration: "none", fontWeight: 800 }}>See a live market</a>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 22, color: "#64748b", fontSize: 13 }}>
            <span>✓ Public-source evidence</span><span>✓ No shared lead-list markup</span><span>✓ Access starts after checkout</span>
          </div>
        </div>

        <aside style={{ background: "#ffffff", border: "1px solid #dbe3ee", borderRadius: 20, padding: 24, boxShadow: "0 18px 55px rgba(15,23,42,.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div><div style={{ color: "#64748b", fontSize: 12, fontWeight: 750, textTransform: "uppercase", letterSpacing: ".08em" }}>Live coverage</div><div style={{ fontSize: 24, fontWeight: 850, marginTop: 4 }}>What PermitRail sees now</div></div>
            <span style={{ fontSize: 12, color: "#166534", background: "#dcfce7", padding: "6px 9px", borderRadius: 999, fontWeight: 750 }}>LIVE</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 20 }}>
            {[
              ["Signals", state?.totalSignals ?? "—"],
              ["High priority", state?.hotSignals ?? "—"],
              ["Sources online", onlineSources || "—"],
            ].map(([label, value]) => <div key={String(label)} style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}><div style={{ fontSize: 24, fontWeight: 850 }}>{value}</div><div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{label}</div></div>)}
          </div>
          <div style={{ marginTop: 20, fontSize: 12, color: "#64748b", fontWeight: 750 }}>RECENT HIGH-SCORE SIGNALS</div>
          <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
            {top.length ? top.map(row => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: 12, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <div><strong style={{ fontSize: 14 }}>{cityLabels[row.city]} · {titleCase(row.primaryTrade)}</strong><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Score {row.score} · {row.ageHours == null ? "recent" : `${Math.max(0, Math.round(row.ageHours))}h old`}</div></div>
                <div style={{ fontWeight: 850, color: "#0f766e" }}>{dollar(row.estimatedOpportunityValueUsd)}</div>
              </div>
            )) : <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", color: "#64748b", fontSize: 13 }}>The live feed is refreshing. You can still browse a market sample below.</div>}
          </div>
        </aside>
      </section>

      <section id="how" style={{ background: "#ffffff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "54px 24px" }}>
          <div style={{ maxWidth: 720 }}><div style={{ color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Built for action, not browsing</div><h2 style={{ fontSize: 36, letterSpacing: "-.03em", margin: "8px 0 12px" }}>From raw public record to a ranked project list.</h2><p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.6 }}>PermitRail removes the repetitive searching and triage. You decide what work to pursue.</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 28 }}>
            {[
              ["1", "We watch the records", "Permit and project sources are refreshed automatically across supported DFW markets."],
              ["2", "We score the opportunity", "Each signal is classified by trade, recency, urgency, likely value and adjacent trades."],
              ["3", "You get the useful slice", "Open your private JSON/CSV feed or use the live market view instead of combing through city portals."],
            ].map(([n, title, copy]) => <div key={String(n)} style={{ padding: 22, border: "1px solid #e2e8f0", borderRadius: 16, background: "#ffffff" }}><div style={{ width: 32, height: 32, borderRadius: 9, background: "#eff6ff", color: "#1d4ed8", display: "grid", placeItems: "center", fontWeight: 850 }}>{n}</div><h3 style={{ margin: "16px 0 7px", fontSize: 18 }}>{title}</h3><p style={{ color: "#64748b", lineHeight: 1.55, margin: 0, fontSize: 14 }}>{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section id="pricing" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 24px 44px" }}>
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 32px" }}>
          <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Simple monthly coverage</div>
          <h2 style={{ fontSize: 40, letterSpacing: "-.035em", margin: "8px 0 12px" }}>Pick the footprint that matches your business.</h2>
          <p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.6 }}>Secure Stripe checkout. Your private feed is available immediately after payment.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, alignItems: "stretch" }}>
          <article style={{ border: "1px solid #dbe3ee", borderRadius: 18, padding: 24, background: "#ffffff", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>STARTER</div>
            <h3 style={{ fontSize: 22, margin: "7px 0" }}>One market. One trade.</h3>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em" }}>${PERMITRAIL_PLANS.starter.monthlyUsd}<span style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>/mo</span></div>
            <p style={{ color: "#64748b", lineHeight: 1.5, minHeight: 62 }}>Best for a focused contractor who wants one clean local opportunity stream.</p>
            <form action="/api/permitrail/checkout" method="post" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="plan" value="starter" />
              <div><label htmlFor="starter-city" style={{ ...labelStyle, display: "block" }}>Market</label><select id="starter-city" name="city" defaultValue="fortworth" style={inputStyle}>{PERMITRAIL_CITIES.map(city => <option value={city} key={city}>{cityLabels[city]}</option>)}</select></div>
              <div><label htmlFor="starter-trade" style={{ ...labelStyle, display: "block" }}>Trade</label><select id="starter-trade" name="trade" defaultValue="general-contractor" style={inputStyle}>{PERMITRAIL_TRADES.map(trade => <option value={trade} key={trade}>{titleCase(trade)}</option>)}</select></div>
              <button disabled={!configured} style={{ marginTop: 4, padding: "13px 14px", border: 0, borderRadius: 10, fontWeight: 850, background: configured ? "#2563eb" : "#94a3b8", color: "white", cursor: configured ? "pointer" : "not-allowed" }}>{configured ? "Start Starter — $299/mo" : "Checkout unavailable"}</button>
            </form>
          </article>

          <article style={{ border: "2px solid #2563eb", borderRadius: 18, padding: 24, background: "#ffffff", boxShadow: "0 16px 40px rgba(37,99,235,.12)", position: "relative" }}>
            <div style={{ position: "absolute", top: -13, left: 22, background: "#2563eb", color: "white", borderRadius: 999, padding: "5px 10px", fontSize: 11, fontWeight: 850 }}>BEST FOR GROWTH</div>
            <div style={{ color: "#2563eb", fontSize: 12, fontWeight: 800, marginTop: 4 }}>GROWTH</div>
            <h3 style={{ fontSize: 22, margin: "7px 0" }}>One trade across DFW.</h3>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em" }}>${PERMITRAIL_PLANS.growth.monthlyUsd}<span style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>/mo</span></div>
            <p style={{ color: "#64748b", lineHeight: 1.5, minHeight: 62 }}>For a trade team that works across supported DFW markets and wants a larger feed.</p>
            <form action="/api/permitrail/checkout" method="post" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="plan" value="growth" /><input type="hidden" name="city" value="all" />
              <div><label htmlFor="growth-trade" style={{ ...labelStyle, display: "block" }}>Trade</label><select id="growth-trade" name="trade" defaultValue="general-contractor" style={inputStyle}>{PERMITRAIL_TRADES.map(trade => <option value={trade} key={trade}>{titleCase(trade)}</option>)}</select></div>
              <div style={{ padding: "12px 13px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 13 }}>Coverage: all supported DFW markets</div>
              <button disabled={!configured} style={{ marginTop: 4, padding: "13px 14px", border: 0, borderRadius: 10, fontWeight: 850, background: configured ? "#2563eb" : "#94a3b8", color: "white", cursor: configured ? "pointer" : "not-allowed" }}>{configured ? "Start Growth — $799/mo" : "Checkout unavailable"}</button>
            </form>
          </article>

          <article style={{ border: "1px solid #dbe3ee", borderRadius: 18, padding: 24, background: "#ffffff", boxShadow: "0 8px 24px rgba(15,23,42,.04)" }}>
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>OPERATOR</div>
            <h3 style={{ fontSize: 22, margin: "7px 0" }}>All markets. All trades.</h3>
            <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-.04em" }}>${PERMITRAIL_PLANS.operator.monthlyUsd}<span style={{ fontSize: 15, fontWeight: 600, color: "#64748b" }}>/mo</span></div>
            <p style={{ color: "#64748b", lineHeight: 1.5, minHeight: 62 }}>For multi-trade operators, agencies and teams that want the full supported feed.</p>
            <form action="/api/permitrail/checkout" method="post" style={{ display: "grid", gap: 10 }}>
              <input type="hidden" name="plan" value="operator" /><input type="hidden" name="city" value="all" /><input type="hidden" name="trade" value="all" />
              <div style={{ padding: "12px 13px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 13 }}>Full supported DFW feed · up to 500 scored signals/request</div>
              <div style={{ padding: "12px 13px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, color: "#475569", fontSize: 13 }}>No configuration required</div>
              <button disabled={!configured} style={{ marginTop: 4, padding: "13px 14px", border: 0, borderRadius: 10, fontWeight: 850, background: configured ? "#2563eb" : "#94a3b8", color: "white", cursor: configured ? "pointer" : "not-allowed" }}>{configured ? "Start Operator — $1,499/mo" : "Checkout unavailable"}</button>
            </form>
          </article>
        </div>
        <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, marginTop: 16 }}>Payments are processed securely by Stripe. PermitRail does not sell private consumer contact data.</div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 24px 66px" }}>
        <div style={{ background: "#eef5ff", border: "1px solid #cfe0ff", borderRadius: 18, padding: 26, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
          <div><h2 style={{ margin: "0 0 8px", fontSize: 26 }}>See the product before you buy.</h2><p style={{ color: "#475569", lineHeight: 1.55, margin: 0 }}>Open a live market page to see current counts and masked sample opportunities from the same feed subscribers receive.</p></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>{[["Fort Worth electrical","fortworth","electrical"],["Arlington HVAC","arlington","hvac"],["Dallas restoration","dallas","restoration"]].map(([label, city, trade]) => <a key={String(label)} href={`/permitrail/market/${city}/${trade}`} style={{ padding: "10px 12px", background: "#ffffff", border: "1px solid #bdd3fb", borderRadius: 9, color: "#1d4ed8", textDecoration: "none", fontWeight: 750, fontSize: 13 }}>{label} →</a>)}</div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid #e2e8f0", background: "#ffffff" }}><div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", color: "#64748b", fontSize: 12 }}><span>PermitRail by PennyRail · Independent public-record intelligence. Verify source records before acting.</span><span><a href="/permitrail/terms" style={{ color: "#475569" }}>Terms</a> · <a href="/permitrail/privacy" style={{ color: "#475569" }}>Privacy</a></span></div></footer>
    </main>
  );
}
