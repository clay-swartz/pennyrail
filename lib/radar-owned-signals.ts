type AnyObj = Record<string, any>;

function env(name: string) {
  return process.env[name]?.trim() || "";
}

async function x402ListBest(intent: string) {
  const url = new URL("https://x402-list.com/api/v1/best");
  url.searchParams.set("q", intent);
  url.searchParams.set("network", "BSE");
  url.searchParams.set("prefer", "cheapest");
  url.searchParams.set("limit", "5");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return {
      ok: response.ok,
      status: response.status,
      source: "x402-list-best",
      result: body,
    };
  } catch (error) {
    return {
      ok: false,
      source: "x402-list-best",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function persistSnapshot(source: string, payload: AnyObj) {
  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return { configured: false };

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/pennyrail_radar_snapshots`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({ source, payload }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return {
      configured: true,
      stored: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      configured: true,
      stored: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function recordOwnedFindSignal(args: {
  intent: string;
  topScore: number;
  candidateCount: number;
}) {
  const market = await x402ListBest(args.intent);
  const payload = {
    type: "pennyrail-find-gap",
    observedAt: new Date().toISOString(),
    intent: args.intent,
    topScore: args.topScore,
    candidateCount: args.candidateCount,
    market,
  };

  const persistence = await persistSnapshot("pennyrail-find-gap", payload);
  return {
    ...payload,
    persistence,
    interpretation:
      args.candidateCount === 0
        ? "PennyRail has no local answer; compare external supply/price and treat repeated demand as a Builder candidate."
        : "PennyRail match is weak; treat repeated intent as a discovery or product-specificity opportunity.",
  };
}
