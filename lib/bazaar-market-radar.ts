import { GAP_ARBITRAGE_PRODUCTS, type GapArbitrageProduct } from "@/lib/gap-arbitrage-catalog";

const BAZAAR_MCP = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp";
const PENNYRAIL_ORIGIN = "https://pennyrail.vercel.app";

type AnyObj = Record<string, any>;

export type BazaarResource = {
  resource: string | null;
  description: string | null;
  serviceName: string | null;
  priceUsd: number | null;
  quality: AnyObj | null;
  raw: AnyObj;
};

export type BazaarSearchAudit = {
  query: string;
  ok: boolean;
  status: number;
  searchMethod: string | null;
  resourceCount: number;
  pennyrailFound: boolean;
  pennyrailRank: number | null;
  pennyrail: BazaarResource | null;
  cheapestExternalUsd: number | null;
  externalSupplyCount: number;
  top: BazaarResource[];
  error?: string;
};

function finitePrice(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resourcePriceUsd(row: AnyObj): number | null {
  const accepts = Array.isArray(row?.accepts) ? row.accepts : [];
  const prices = accepts
    .map((accept: AnyObj): number | null => {
      const raw = accept?.amount ?? accept?.maxAmountRequired ?? accept?.price;
      const numeric = finitePrice(raw);
      if (numeric == null) return null;

      // CDP Bazaar returns USDC amounts in atomic units for standard x402
      // requirements. If a human USD price is already present, preserve it.
      if (numeric >= 1000 && String(accept?.asset || "").toLowerCase().includes("833589")) {
        return numeric / 1_000_000;
      }
      if (numeric >= 1000 && String(raw || "").match(/^\d+$/)) {
        return numeric / 1_000_000;
      }
      return numeric;
    })
    .filter((value: number | null): value is number => value != null);

  const explicit =
    finitePrice(row?.priceUsd) ??
    finitePrice(row?.price_usd) ??
    finitePrice(row?.price?.usd) ??
    finitePrice(row?.price);

  if (explicit != null) return explicit;
  return prices.length ? Math.min(...prices) : null;
}

function asBazaarResource(value: unknown): BazaarResource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as AnyObj;
  const resource = typeof row.resource === "string"
    ? row.resource
    : typeof row.url === "string"
      ? row.url
      : typeof row.resourceUrl === "string"
        ? row.resourceUrl
        : null;

  if (!resource) return null;

  return {
    resource,
    description: typeof row.description === "string" ? row.description : null,
    serviceName:
      typeof row.serviceName === "string"
        ? row.serviceName
        : typeof row.name === "string"
          ? row.name
          : null,
    priceUsd: resourcePriceUsd(row),
    quality: row.quality && typeof row.quality === "object" ? row.quality : null,
    raw: row,
  };
}

function parseJsonMaybe(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function collectResources(value: unknown, out: BazaarResource[], depth = 0): void {
  if (depth > 8 || value == null) return;

  if (typeof value === "string") {
    const parsed = parseJsonMaybe(value);
    if (parsed != null) collectResources(parsed, out, depth + 1);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectResources(item, out, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  const row = value as AnyObj;

  const direct = asBazaarResource(row);
  if (direct) {
    out.push(direct);
    return;
  }

  // MCP results commonly wrap JSON in content[].text or structuredContent.
  const priorityKeys = [
    "resources",
    "results",
    "items",
    "matches",
    "structuredContent",
    "content",
    "data",
    "result",
  ];
  for (const key of priorityKeys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      collectResources(row[key], out, depth + 1);
    }
  }
}

function dedupeResources(rows: BazaarResource[]): BazaarResource[] {
  const seen = new Set<string>();
  const out: BazaarResource[] = [];
  for (const row of rows) {
    const key = String(row.resource || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function bazaarSearch(query: string): Promise<BazaarSearchAudit> {
  try {
    const response = await fetch(BAZAAR_MCP, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `pennyrail-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        method: "tools/call",
        params: {
          name: "search_resources",
          arguments: { query },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    const rawText = await response.text();
    let payload: unknown = parseJsonMaybe(rawText);

    // Some MCP servers use SSE framing even for a single response.
    if (payload == null && rawText.includes("data:")) {
      const lines = rawText.split(/\r?\n/);
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const parsed = parseJsonMaybe(line.slice(5).trim());
        if (parsed != null) {
          payload = parsed;
          break;
        }
      }
    }

    const resources: BazaarResource[] = [];
    collectResources(payload, resources);
    const unique = dedupeResources(resources);

    const pennyrailIndex = unique.findIndex((row: BazaarResource): boolean =>
      String(row.resource || "").toLowerCase().includes("pennyrail.vercel.app/")
    );
    const external = unique.filter((row: BazaarResource): boolean =>
      !String(row.resource || "").toLowerCase().includes("pennyrail.vercel.app/")
    );
    const externalPrices = external
      .map((row: BazaarResource): number | null => row.priceUsd)
      .filter((value: number | null): value is number => value != null);

    const payloadObj = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as AnyObj
      : {};

    return {
      query,
      ok: response.ok && !payloadObj?.error,
      status: response.status,
      searchMethod:
        typeof payloadObj?.searchMethod === "string"
          ? payloadObj.searchMethod
          : typeof payloadObj?.result?.searchMethod === "string"
            ? payloadObj.result.searchMethod
            : null,
      resourceCount: unique.length,
      pennyrailFound: pennyrailIndex >= 0,
      pennyrailRank: pennyrailIndex >= 0 ? pennyrailIndex + 1 : null,
      pennyrail: pennyrailIndex >= 0 ? unique[pennyrailIndex] : null,
      cheapestExternalUsd: externalPrices.length ? Math.min(...externalPrices) : null,
      externalSupplyCount: external.length,
      top: unique.slice(0, 5),
      ...(payloadObj?.error
        ? { error: String(payloadObj.error?.message || payloadObj.error) }
        : !response.ok
          ? { error: `Coinbase Bazaar MCP HTTP ${response.status}` }
          : {}),
    };
  } catch (error) {
    return {
      query,
      ok: false,
      status: 0,
      searchMethod: null,
      resourceCount: 0,
      pennyrailFound: false,
      pennyrailRank: null,
      pennyrail: null,
      cheapestExternalUsd: null,
      externalSupplyCount: 0,
      top: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function unresolvedIntent(row: AnyObj): string {
  const candidates: unknown[] = [
    row?.demand?.text,
    row?.demandText,
    row?.query,
    row?.title,
    row?.alias,
    row?.name,
    row?.id,
  ];
  return String(candidates.find((value: unknown): boolean =>
    typeof value === "string" && Boolean(value.trim())
  ) || "").trim();
}

function opportunityScore(row: AnyObj): number {
  const demand = Number(row?.demand?.score ?? row?.score ?? row?.demandScore ?? 0);
  const sales = Number(row?.sales ?? row?.demand?.sales ?? row?.txCount ?? row?.transactions ?? 0);
  const buyers = Number(row?.buyers ?? row?.demand?.buyers ?? row?.uniqueBuyers ?? 0);
  const price = Number(row?.priceUsd ?? row?.price ?? row?.demand?.priceUsd ?? 0);
  return (Number.isFinite(demand) ? demand : 0)
    + Math.log10(Math.max(1, Number.isFinite(sales) ? sales : 0) + 1) * 12
    + Math.log10(Math.max(1, Number.isFinite(buyers) ? buyers : 0) + 1) * 10
    + Math.min(20, Math.max(0, Number.isFinite(price) ? price : 0) * 20);
}

function currentProductQueries(): Array<{ product: GapArbitrageProduct; query: string }> {
  return GAP_ARBITRAGE_PRODUCTS.map((product: GapArbitrageProduct) => ({
    product,
    query: product.intents[0] || product.title,
  }));
}

export async function auditBazaarMarket(audit: AnyObj) {
  const productTargets = currentProductQueries();

  const unresolvedRows = Array.isArray(audit?.unresolved)
    ? [...audit.unresolved]
      .sort((a: AnyObj, b: AnyObj): number => opportunityScore(b) - opportunityScore(a))
      .slice(0, 8)
    : [];

  const productSearches = await Promise.all(
    productTargets.map(async ({ product, query }) => ({
      productId: product.id,
      path: product.path,
      title: product.title,
      priceUsd: product.priceUsd,
      search: await bazaarSearch(query),
    }))
  );

  const unresolvedSearches = await Promise.all(
    unresolvedRows.map(async (row: AnyObj) => {
      const intent = unresolvedIntent(row);
      const search = intent ? await bazaarSearch(intent) : null;
      const cheapest = search?.cheapestExternalUsd ?? null;

      let marketGap: "MISSING" | "UNDERCUTTABLE" | "SUPPLIED" | "UNKNOWN" = "UNKNOWN";
      if (search?.ok) {
        if (search.externalSupplyCount === 0) marketGap = "MISSING";
        else if (cheapest != null && cheapest > 0.001) marketGap = "UNDERCUTTABLE";
        else marketGap = "SUPPLIED";
      }

      return {
        intent,
        radar: row,
        opportunityScore: Number(opportunityScore(row).toFixed(2)),
        marketGap,
        cheapestExternalUsd: cheapest,
        externalSupplyCount: search?.externalSupplyCount ?? null,
        topSupply: search?.top ?? [],
        bazaarSearchOk: Boolean(search?.ok),
        bazaarSearchError: search?.error ?? null,
      };
    })
  );

  const indexed = productSearches.filter(row => row.search.pennyrailFound);
  const missing = productSearches.filter(row => !row.search.pennyrailFound);
  const undercuttable = unresolvedSearches.filter(row => row.marketGap === "UNDERCUTTABLE");
  const unsupplied = unresolvedSearches.filter(row => row.marketGap === "MISSING");

  return {
    source: "Coinbase Bazaar MCP search_resources",
    mcpEndpoint: BAZAAR_MCP,
    generatedAt: new Date().toISOString(),
    productVisibility: {
      checked: productSearches.length,
      indexed: indexed.length,
      missing: missing.length,
      allIndexed: productSearches.length > 0 && missing.length === 0,
      products: productSearches,
    },
    gapArbitrage: {
      unresolvedChecked: unresolvedSearches.length,
      missingSupply: unsupplied.length,
      undercuttable: undercuttable.length,
      suppliedAtFloorOrLower: unresolvedSearches.filter(row => row.marketGap === "SUPPLIED").length,
      opportunities: unresolvedSearches.sort((a, b) => {
        const priority = (value: string) => value === "MISSING" ? 3 : value === "UNDERCUTTABLE" ? 2 : value === "SUPPLIED" ? 1 : 0;
        return priority(b.marketGap) - priority(a.marketGap) || b.opportunityScore - a.opportunityScore;
      }),
    },
    nextAction:
      missing.length
        ? "FIX_BAZAAR_INDEXING"
        : unsupplied.length || undercuttable.length
          ? "BUILD_HIGHEST_VALUE_GAP"
          : "MULTIPLY_CURRENT_WINNERS",
    note:
      "This is Radar market intelligence, not revenue. MISSING means no external Bazaar supply surfaced for that intent; UNDERCUTTABLE means external supply surfaced above the $0.001 facilitator floor.",
  };
}
