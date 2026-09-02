import { permitRailAccessToken, retrieveCheckoutSession } from "@/lib/permitrail-stripe";

export const dynamic = "force-dynamic";

export default async function PermitRailSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const params = await searchParams;
  const sessionId = String(params?.session_id || "");
  let error: string | null = null;
  let accessUrl: string | null = null;
  let csvUrl: string | null = null;
  let plan = "";
  try {
    const session = await retrieveCheckoutSession(sessionId);
    const status = String(session?.subscription?.status || "");
    if (!(status === "active" || status === "trialing")) throw new Error(`Subscription is ${status || "not active"}`);
    plan = String(session?.metadata?.plan || session?.subscription?.metadata?.plan || "starter");
    const token = permitRailAccessToken(sessionId);
    accessUrl = `/api/permitrail/subscriber/feed?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
    csvUrl = `${accessUrl}&format=csv`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f7f9fc", color: "#0f172a", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", padding: "64px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <a href="/permitrail" style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 750 }}>← PermitRail</a>
        <section style={{ marginTop: 22, padding: 30, borderRadius: 20, background: "#ffffff", border: "1px solid #dbe3ee", boxShadow: "0 18px 50px rgba(15,23,42,.07)" }}>
          {error ? (
            <><div style={{ display: "inline-block", padding: "6px 9px", borderRadius: 999, background: "#fff7ed", color: "#9a3412", fontSize: 12, fontWeight: 800 }}>VERIFYING PAYMENT</div><h1 style={{ fontSize: 38, letterSpacing: "-.035em", margin: "16px 0 10px" }}>Your payment is still being verified.</h1><p style={{ color: "#64748b", lineHeight: 1.6 }}>{error}</p><p style={{ color: "#64748b" }}>If checkout just completed, refresh this page once. You will not be charged again.</p></>
          ) : (
            <>
              <div style={{ display: "inline-block", padding: "6px 9px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 800 }}>SUBSCRIPTION ACTIVE</div>
              <h1 style={{ fontSize: 42, letterSpacing: "-.04em", margin: "16px 0 10px" }}>You're in. Your PermitRail feed is live.</h1>
              <p style={{ color: "#64748b", fontSize: 17, lineHeight: 1.6 }}>Your <strong>{plan}</strong> subscription is active. There is no separate PermitRail login to configure—the private link below verifies your Stripe subscription whenever you use it.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
                <a href={accessUrl || "/permitrail"} style={{ padding: "12px 16px", borderRadius: 10, background: "#2563eb", color: "white", fontWeight: 800, textDecoration: "none" }}>Open my live feed</a>
                <a href={csvUrl || "/permitrail"} style={{ padding: "12px 16px", borderRadius: 10, background: "#ffffff", color: "#0f172a", fontWeight: 800, textDecoration: "none", border: "1px solid #cbd5e1" }}>Open as CSV</a>
              </div>
              <div style={{ marginTop: 26, padding: 18, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800, marginBottom: 7 }}>YOUR PRIVATE FEED URL</div>
                <code style={{ wordBreak: "break-all", fontSize: 12 }}>{accessUrl}</code>
              </div>
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
                {[ ["Filter by city", "&city=fortworth"], ["Filter by trade", "&trade=roofing"], ["Only stronger signals", "&minScore=60"] ].map(([title, code]) => <div key={title} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}><strong style={{ fontSize: 13 }}>{title}</strong><div style={{ marginTop: 7 }}><code style={{ fontSize: 12, color: "#1d4ed8" }}>{code}</code></div></div>)}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
