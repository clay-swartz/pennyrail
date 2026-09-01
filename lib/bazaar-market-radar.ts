import { GAP_ARBITRAGE_PRODUCTS, type GapArbitrageProduct } from "@/lib/gap-arbitrage-catalog";

const BAZAAR_SEARCH = "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search";
const PENNYRAIL_HOST = "pennyrail.vercel.app";

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

      // x402 v2 Base USDC requirements use 6-decimal atomic amounts.
      const looksAtomic = /^\d+$/.test(String(raw ?? "")) && numeric >= 1000;
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

  const extensions =
    row.extensions && typeof row.extensions === "object"
      ? row.extensions as AnyObj
      : {};
  const bazaar =
    extensions.bazaar && typeof extensions.bazaar === "object"
      ? extensions.bazaar as AnyObj
      : {};

  return {
    resource,
    description:
      typeof row.description === "string" ? row.description :
      typeof bazaar.description === "string" ? bazaar.description :
      null,
    serviceName:
      typeof row.serviceName === "string" ? row.serviceName :
      typeof row.name === "string" ? row.name :
      typeof bazaar.serviceName === "string" ? bazaar.serviceName :
      null,
    priceUsd: resourcePriceUsd(row),
    quality: row.quality && typeof row.quality === "object" ? row.quality : null,
    raw: row,
  };
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

function extractResources(payload: unknown): BazaarResource[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const row = payload as AnyObj;
  const raw =
    Array.isArray(row.resources) ? row.resources :
    Array.isArray(row.items) ? row.items :
    Array.isArray(row.results) ? row.results :
    [];
  return dedupeResources(
    raw
      .map((item: unknown): BazaarResource | null => asBazaarResource(item))
      .filter((item: BazaarResource | null): item is BazaarResource => item != null)
  );
}

function shortIntent(value: string, max = 240): string {
  const clean = value
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  // Revenue Engine needs often contain a compact product name before a dash.
  const lead = clean.split(/\s+-\s+/)[0]?.trim();
  if (lead && lead.length >= 3 && lead.length <= 120) return lead;

  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim();
}

async function fetchBazaar(params: URLSearchParams): Promise<{
  ok: boolean;
  status: number;
  payload: AnyObj | null;
  resources: BazaarResource[];
  error?: string;
}> {
  try {
    const url = new URL(BAZAAR_SEARCH);
    for (const [key, value] of params.entries()) url.searchParams.set(key, value);

    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });

    const text = await response.text();
    let payload: AnyObj | null = null;
    try {
      const parsed = text ? JSON.parse(text) : null;
      payload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as AnyObj
        : null;
    } catch {}

    return {
      ok: response.ok && Boolean(payload),
      status: response.status,
      payload,
      resources: extractResources(payload),
      ...(!response.ok
        ? { error: `Coinbase Bazaar discovery search HTTP ${response.status}: ${text.slice(0, 300)}` }
        : !payload
          ? { error: "Coinbase Bazaar discovery search returned non-JSON or empty JSON." }
          : {}),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: null,
      resources: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function bazaarSearch(query: string): Promise<BazaarSearchAudit> {
  const compactQuery = shortIntent(query);
  const response = await fetchBazaar(new URLSearchParams({
    query: compactQuery,
    network: "eip155:8453",
    type: "http",
    limit: "20",
  }));

  const unique = response.resources;
  const pennyrailIndex = unique.findIndex((row: BazaarResource): boolean =>
    String(row.resource || "").toLowerCase().includes(`${PENNYRAIL_HOST}/`)
  );
  const external = unique.filter((row: BazaarResource): boolean =>
    !String(row.resource || "").toLowerCase().includes(`${PENNYRAIL_HOST}/`)
  );
  const externalPrices = external
    .map((row: BazaarResource): number | null => row.priceUsd)
    .filter((value: number | null): value is number => value != null);

  return {
    query: compactQuery,
    ok: response.ok,
    status: response.status,
    searchMethod:
      typeof response.payload?.searchMethod === "string"
        ? response.payload.searchMethod
        : null,
    resourceCount: unique.length,
    pennyrailFound: pennyrailIndex >= 0,
    pennyrailRank: pennyrailIndex >= 0 ? pennyrailIndex + 1 : null,
    pennyrail: pennyrailIndex >= 0 ? unique[pennyrailIndex] : null,
    cheapestExternalUsd: externalPrices.length ? Math.min(...externalPrices) : null,
    externalSupplyCount: external.length,
    top: unique.slice(0, 5),
    ...(response.error ? { error: response.error } : {}),
  };
}

async function exactPennyRailVisibility() {
  // Coinbase currently supports URL-substring filtering on the discovery search
  // endpoint. This separates exact indexing from semantic ranking.
  const byUrl = await fetchBazaar(new URLSearchParams({
    network: "eip155:8453",
    type: "http",
    urlSubstring: PENNYRAIL_HOST,
    limit: "100",
  }));

  const pennyrail = byUrl.resources.filter((row: BazaarResource): boolean =>
    String(row.resource || "").toLowerCase().includes(PENNYRAIL_HOST)
  );

  return {
    ok: byUrl.ok,
    status: byUrl.status,
    indexedResourceCount: pennyrail.length,
    resources: pennyrail,
    error: byUrl.error ?? null,
  };
}

async function catalogHealth() {
  // A generic sentinel prevents "none of our exact product queries matched" from
  // being mistaken for a broken Coinbase catalog.
  const sentinel = await bazaarSearch("weather API");
  return {
    healthy: sentinel.ok && sentinel.resourceCount > 0,
    sentinel,
  };
}

function unresolvedIntent(row: AnyObj): string {
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

  const [health, exactVisibility, productSearches, unresolvedSearches] = await Promise.all([
    catalogHealth(),
    exactPennyRailVisibility(),
    Promise.all(
      productTargets.map(async ({ product, query }) => ({
        productId: product.id,
        path: product.path,
        title: product.title,
        priceUsd: product.priceUsd,
        search: await bazaarSearch(query),
      }))
    ),
    Promise.all(
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
          querySent: intent ? shortIntent(intent) : "",
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
    ),
  ]);

  const semanticIndexed = productSearches.filter(row => row.search.pennyrailFound);
  const semanticMissing = productSearches.filter(row => !row.search.pennyrailFound);
  const undercuttable = unresolvedSearches.filter(row => row.marketGap === "UNDERCUTTABLE");
  const unsupplied = unresolvedSearches.filter(row => row.marketGap === "MISSING");

  const buyerSearchHealthy = health.healthy;
  const pennyrailIndexed = exactVisibility.ok && exactVisibility.indexedResourceCount > 0;

  return {
    source: "Coinbase Bazaar REST discovery/search",
    searchEndpoint: BAZAAR_SEARCH,
    generatedAt: new Date().toISOString(),
    buyerSearchHealthy,
    catalogHealth: health,
    exactPennyRailVisibility: exactVisibility,
    productVisibility: {
      checked: productSearches.length,
      semanticallyFound: semanticIndexed.length,
      semanticallyMissing: semanticMissing.length,
      exactIndexedResourceCount: exactVisibility.indexedResourceCount,
      pennyrailIndexed,
      products: productSearches,
    },
    gapArbitrage: {
      unresolvedChecked: unresolvedSearches.length,
      missingSupply: unsupplied.length,
      undercuttable: undercuttable.length,
      suppliedAtFloorOrLower: unresolvedSearches.filter(row => row.marketGap === "SUPPLIED").length,
      unknown: unresolvedSearches.filter(row => row.marketGap === "UNKNOWN").length,
      opportunities: unresolvedSearches.sort((a, b) => {
        const priority = (value: string) =>
          value === "MISSING" ? 3 :
          value === "UNDERCUTTABLE" ? 2 :
          value === "SUPPLIED" ? 1 : 0;
        return priority(b.marketGap) - priority(a.marketGap) || b.opportunityScore - a.opportunityScore;
      }),
    },
    nextAction:
      !buyerSearchHealthy
        ? "FIX_BAZAAR_DISCOVERY_API"
        : !pennyrailIndexed
          ? "FIX_BAZAAR_INDEXING"
          : unsupplied.length || undercuttable.length
            ? "BUILD_HIGHEST_VALUE_GAP"
            : "MULTIPLY_CURRENT_WINNERS",
    note:
      "Exact PennyRail URL visibility determines indexing. Semantic rank is measured separately. Long Revenue Engine descriptions are shortened before Bazaar search. Internal seed settlements remain excluded from organic revenue.",
  };
}
