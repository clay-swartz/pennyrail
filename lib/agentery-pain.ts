import { resolveRevenueNeed } from "@/lib/revenue-engine";

const AGENTERY_MCP = "https://agentery.com/api/mcp";

type JsonRpcResponse = {
  result?: any;
  error?: { code?: number; message?: string; data?: any };
};

async function rpc(method: string, params?: any): Promise<any> {
  const response = await fetch(AGENTERY_MCP, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": "PennyRail/1.0 demand-gap-radar",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, ...(params ? { params } : {}) }),
    cache: "no-store",
    signal: AbortSignal.timeout(18_000),
  });
  const text = await response.text();
  let body: JsonRpcResponse | null = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(`Agentery HTTP ${response.status}: ${text.slice(0, 500)}`);
  if (body?.error) throw new Error(`Agentery RPC ${body.error.code ?? "error"}: ${body.error.message || "unknown error"}`);
  return body?.result ?? null;
}

function schemaArgs(schema: any) {
  const props = schema?.properties && typeof schema.properties === "object" ? schema.properties : {};
  const args: Record<string, any> = {};
  if (props.response_mode) args.response_mode = "summary";
  if (props.limit) args.limit = 25;
  if (props.max_results) args.max_results = 25;
  if (props.top_k) args.top_k = 25;
  return args;
}

function collectDemandPhrases(value: any, out: string[], keyHint = "") {
  if (out.length >= 80 || value == null) return;
  if (typeof value === "string") {
    const key = keyHint.toLowerCase();
    const usefulKey = /(query|request|need|demand|gap|title|label|cluster|capability|task|description|phrase|text)/.test(key);
    const clean = value.replace(/\s+/g, " ").trim();
    if (usefulKey && clean.length >= 8 && clean.length <= 280) out.push(clean);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDemandPhrases(item, out, keyHint);
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) collectDemandPhrases(item, out, key);
  }
}

function uniquePhrases(...values: any[]) {
  const raw: string[] = [];
  for (const value of values) collectDemandPhrases(value, raw);
  const seen = new Set<string>();
  return raw.filter(value => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

export async function scanAgenteryPain() {
  try {
    const toolsResult = await rpc("tools/list");
    const tools: any[] = Array.isArray(toolsResult?.tools) ? toolsResult.tools : [];
    const byName = new Map(tools.map(tool => [String(tool?.name || ""), tool]));

    const call = async (name: string) => {
      const tool = byName.get(name);
      if (!tool) return { available: false, result: null };
      const args = schemaArgs(tool?.inputSchema || tool?.input_schema);
      const result = await rpc("tools/call", { name, arguments: args });
      return { available: true, result };
    };

    const [demandSignals, marketGaps] = await Promise.all([
      call("demand_signals"),
      call("market_gaps"),
    ]);

    const phrases = uniquePhrases(demandSignals.result, marketGaps.result);
    const classified = phrases.map(phrase => {
      const resolved = resolveRevenueNeed(phrase);
      return {
        phrase,
        existingProductId: resolved?.product?.id ?? null,
        matchScore: resolved?.score ?? 0,
        state: resolved && resolved.score >= 5 ? "EXISTING_CAPABILITY" : "UNRESOLVED_GAP",
      };
    });

    return {
      ok: true,
      source: "Agentery public MCP",
      endpoint: AGENTERY_MCP,
      generatedAt: new Date().toISOString(),
      demandSignalsAvailable: demandSignals.available,
      marketGapsAvailable: marketGaps.available,
      phrasesObserved: phrases.length,
      existingCapabilityMatches: classified.filter(row => row.state === "EXISTING_CAPABILITY").slice(0, 20),
      unresolvedGaps: classified.filter(row => row.state === "UNRESOLVED_GAP").slice(0, 20),
      raw: {
        demandSignals: demandSignals.result,
        marketGaps: marketGaps.result,
      },
    };
  } catch (error) {
    return {
      ok: false,
      source: "Agentery public MCP",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
