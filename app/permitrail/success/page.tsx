import { permitRailAccessToken, retrieveCheckoutSession } from "@/lib/permitrail-stripe";

export const dynamic = "force-dynamic";

export default async function PermitRailSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const params = await searchParams;
  const sessionId = String(params?.session_id || "");
  let error: string | null = null;
  let accessUrl: string | null = null;
  let plan = "";
  try {
    const session = await retrieveCheckoutSession(sessionId);
    const status = String(session?.subscription?.status || "");
    if (!(status === "active" || status === "trialing")) throw new Error(`Subscription is ${status || "not active"}`);
    plan = String(session?.metadata?.plan || session?.subscription?.metadata?.plan || "starter");
    const token = permitRailAccessToken(sessionId);
    accessUrl = `/api/permitrail/subscriber/feed?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ textTransform: "uppercase", letterSpacing: 1.4, fontSize: 12, fontWeight: 700 }}>PermitRail</p>
      {error ? (
        <><h1>We couldn't verify the subscription yet.</h1><p>{error}</p><p>If checkout just completed, refresh this page once.</p></>
      ) : (
        <>
          <h1>You're live.</h1>
          <p>Your <strong>{plan}</strong> subscription is active. This private feed URL validates the Stripe subscription on every request, so there is no separate account or password to manage.</p>
          <div style={{ padding: 18, background: "#f5f1e8", borderRadius: 14, wordBreak: "break-all", margin: "22px 0" }}><code>{accessUrl}</code></div>
          <p>Add filters such as <code>&city=fortworth&trade=roofing&minScore=60&format=csv</code>.</p>
          <p><a href={accessUrl || "/permitrail"}>Open your live feed</a></p>
        </>
      )}
    </main>
  );
}
