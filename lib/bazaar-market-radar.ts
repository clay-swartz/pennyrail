import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { GAP_ARBITRAGE_PRODUCTS, type GapArbitrageProduct } from "@/lib/gap-arbitrage-catalog";

const BAZAAR_MCP = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/mcp";

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
  const explicit =
    finitePrice(row?.priceUsd) ??
    finitePrice(row?.price_usd) ??
    finitePrice(row?.price?.usd) ??
    finitePrice(row?.price);
  if (explicit != null) return explicit;

  const accepts = Array.isArray(row?.accepts) ? row.accepts : [];
  const prices = accepts
    .map((accept: AnyObj): number | null => {
      const raw = accept?.amount ?? accept?.maxAmountRequired ?? accept?.price;
      const numeric = finitePrice(raw);
      if (numeric == null) return null;

      // Standard Base USDC requirements are returned in 6-decimal atomic units.
      const rawText = String(raw ?? "");
      const looksAtomic = /^\d+$/.test(rawText) && numeric >= 1000;
      return looksAtomic ? numeric / 1_000_000 : numeric;
    })
    .filter((value: number | null): value is number => value != null);

  return prices.length ? Math.min(...prices) : null;
}

function asBazaarResource(value: unknown): BazaarResource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as AnyObj;
  const resource =
    typeof row.resource === "string" ? row.resource :
    typeof row.url === "string" ? row.url :
    typeof row.resourceUrl === "string" ? row.resourceUrl :
    null;

  if (!resource) return null;

  return {
    resource,
    description: typeof row.description === "string" ? row.description : null,
    serviceName:
      typeof row.serviceName === "string" ? row.serviceName :
      typeof row.name === "string" ? row.name :
      null,
    priceUsd: resourcePriceUsd(row),
    quality: row.quality && typeof row.quality === "object" ? row.quality : null,
    raw: row,
  };
}

function parseJsonMaybe(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}

function collectResources(value: unknown, out: BazaarResource[], depth = 0): void {
  if (depth > 10 || value == null) return;

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

  for (const key of [
    "resources",
    "results",
    "items",
    "matches",
    "structuredContent",
    "content",
    "data",
    "result",
  ]) {
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

function findString(value: unknown, key: string, depth = 0): string | null {
  if (depth > 8 || value == null) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, key, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const row = value as AnyObj;
  if (typeof row[key] === "string") return row[key];
  for (const child of Object.values(row)) {
    const found = findString(child, key, depth + 1);
    if (found) return found;
  }
  return null;
}

async function bazaarSearch(client: Client, query: string): Promise<BazaarSearchAudit> {
  try {
    // Important: this is a real MCP client call after connect()/initialize.
    // v44 incorrectly sent tools/call as a stateless raw HTTP request.
    const payload = await client.callTool({
      name: "search_resources",
      arguments: { query },
    });

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

    const isError = Boolean((payload as AnyObj)?.isError);
    const errorText = isError
      ? String(
          (payload as AnyObj)?.content?.find?.((item: AnyObj) => item?.type === "text")?.text ||
          "Coinbase Bazaar MCP search_resources returned an error"
        )
      : undefined;

    return {
      query,
      ok: !isError,
      status: isError ? 502 : 200,
      searchMethod: findString(payload, "searchMethod"),
      resourceCount: unique.length,
      pennyrailFound: pennyrailIndex >= 0,
      pennyrailRank: pennyrailIndex >= 0 ? pennyrailIndex + 1 : null,
      pennyrail: pennyrailIndex >= 0 ? unique[pennyrailIndex] : null,
      cheapestExternalUsd: externalPrices.length ? Math.min(...externalPrices) : null,
      externalSupplyCount: external.length,
      top: unique.slice(0, 5),
      ...(errorText ? { error: errorText } : {}),
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
  // v44 bug: `need` is the actual Revenue Engine field and was omitted,
  // which turned every unresolved market query into an empty string.
  const candidates: unknown[] = [
    row?.need,
    row?.demand?.text,
    row?.demandText,
    row?.query,
    row?.title,
    row?.alias,
    row?.name,
    row?.id,
  ];
  return String(
    candidates.find((value: unknown): boolean =>
      typeof value === "string" && Boolean(value.trim())
    ) || ""
  ).trim();
}

function opportunityScore(row: AnyObj): number {
  const demand = Number(row?.demand?.score ?? row?.score ?? row?.demandScore ?? 0);
  const sales = Number(row?.bestseller?.sales ?? row?.sales ?? row?.demand?.sales ?? row?.txCount ?? row?.transactions ?? 0);
  const buyers = Number(row?.bestseller?.buyers ?? row?.buyers ?? row?.demand?.buyers ?? row?.uniqueBuyers ?? 0);
  const price = Number(row?.bestseller?.avgTicketUsd ?? row?.priceUsd ?? row?.price ?? row?.demand?.priceUsd ?? 0);

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

  const client = new Client(
    { name: "pennyrail-radar", version: "44.1.0" },
    { versionNegotiation: { mode: "legacy" } }
  );

  try {
    // Coinbase documents Bazaar MCP as a Streamable HTTP MCP server.
    // connect() performs the initialize handshake and maintains session state.
    await client.connect(new StreamableHTTPClientTransport(new URL(BAZAAR_MCP)));

    const productSearches = await Promise.all(
      productTargets.map(async ({ product, query }) => ({
        productId: product.id,
        path: product.path,
        title: product.title,
        priceUsd: product.priceUsd,
        search: await bazaarSearch(client, query),
      }))
    );

    const unresolvedSearches = await Promise.all(
      unresolvedRows.map(async (row: AnyObj) => {
        const intent = unresolvedIntent(row);
        const search = intent ? await bazaarSearch(client, intent) : null;
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
    const workingSearches = productSearches.filter(row => row.search.ok && row.search.resourceCount > 0);

    return {
      source: "Coinbase Bazaar MCP search_resources via initialized MCP client",
      mcpEndpoint: BAZAAR_MCP,
      generatedAt: new Date().toISOString(),
      buyerSearchHealthy: workingSearches.length > 0,
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
          const priority = (value: string) =>
            value === "MISSING" ? 3 :
            value === "UNDERCUTTABLE" ? 2 :
            value === "SUPPLIED" ? 1 : 0;
          return priority(b.marketGap) - priority(a.marketGap) || b.opportunityScore - a.opportunityScore;
        }),
      },
      nextAction:
        workingSearches.length === 0
          ? "FIX_BAZAAR_BUYER_SEARCH"
          : missing.length
            ? "FIX_BAZAAR_INDEXING"
            : unsupplied.length || undercuttable.length
              ? "BUILD_HIGHEST_VALUE_GAP"
              : "MULTIPLY_CURRENT_WINNERS",
      note:
        "MISSING means no external Bazaar supply surfaced for a real non-empty Radar intent. UNDERCUTTABLE means external supply surfaced above the $0.001 floor. Internal seed settlements are never organic revenue.",
    };
  } catch (error) {
    return {
      source: "Coinbase Bazaar MCP search_resources via initialized MCP client",
      mcpEndpoint: BAZAAR_MCP,
      generatedAt: new Date().toISOString(),
      buyerSearchHealthy: false,
      productVisibility: {
        checked: productTargets.length,
        indexed: 0,
        missing: productTargets.length,
        allIndexed: false,
        products: [],
      },
      gapArbitrage: {
        unresolvedChecked: 0,
        missingSupply: 0,
        undercuttable: 0,
        suppliedAtFloorOrLower: 0,
        opportunities: [],
      },
      nextAction: "FIX_BAZAAR_BUYER_SEARCH",
      error: error instanceof Error ? error.message : String(error),
      note: "The audit could not establish a valid initialized Coinbase Bazaar MCP buyer session.",
    };
  } finally {
    try { await client.close(); } catch {}
  }
}
