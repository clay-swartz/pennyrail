import { FACTORY_CAPABILITIES, matchCapability, runFactoryOperation, type FactoryCapability } from "@/lib/factory";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";

export type RevenueTier = "nano" | "network" | "micro" | "standard";

export const REVENUE_TIER_PRICE: Record<RevenueTier, number> = {
  nano: 0.001,
  network: 0.003,
  micro: 0.004,
  standard: 0.01,
};

export type RevenueProductDefinition = {
  id: string;
  title: string;
  description: string;
  aliases: string[];
  tier: RevenueTier;
  inputHint: string;
  sampleInput: unknown;
  source: "factory" | "template";
  operation?: string;
  template?: "vin-decode" | "osv-package" | "dns-records" | "batch-utility";
};

export type RevenueProductRoute = Omit<RevenueProductDefinition, "source"> & {
  alias: string;
  slug: string;
  path: string;
  priceUsd: number;
  source: "factory" | "template" | "demand";
  demand?: {
    text: string;
    count: number;
    score: number;
    signalType: string;
    supplyMatches: number;
  };
};

type AnyRow = Record<string, any>;

type MarketService = {
  slug: string;
  name: string;
  description: string;
  category: string;
  minPriceUsd: number | null;
  volumeUsd30d: number;
  txCount30d: number;
  buyers30d: number;
  topBuyerShare30d: number | null;
  trend7dVs30d: number | null;
};

function asText(value: unknown) {
  return value == null ? "" : String(value);
}

function cleanSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "product";
}

function unique(values: string[]) {
  return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}

function sampleForCapability(cap: FactoryCapability): unknown {
  const h = cap.inputHint.toLowerCase();
  if (cap.id === "text.lines-dedupe" || cap.id === "text.lines-sort" || cap.id === "text.remove-empty-lines") return "alpha\nbeta\nalpha";
  if (cap.id === "text.truncate") return { text: "PennyRail autonomous revenue engine", max: 18 };
  if (cap.id === "json.flatten" || cap.id === "json.keys" || cap.id === "json.sort-keys") return { user: { name: "Ada", id: 1 } };
  if (cap.id === "json.get") return { value: { user: { name: "Ada" } }, path: "user.name" };
  if (cap.id === "json.pick" || cap.id === "json.omit") return { value: { a: 1, b: 2 }, keys: ["a"] };
  if (cap.id === "url.parse" || cap.id === "url.normalize" || cap.id === "url.domain") return "https://example.com/path?utm_source=test&a=1";
  if (cap.id === "url.resolve") return { base: "https://example.com/a/", relative: "../b" };
  if (cap.id === "url.query-to-json") return "a=1&b=two";
  if (cap.id === "url.json-to-query") return { a: 1, b: "two" };
  if (cap.id === "number.stats" || cap.id === "number.sum") return [1, 2, 3, 4];
  if (cap.id === "number.percent-change") return { from: 100, to: 125 };
  if (cap.id === "number.clamp") return { value: 15, min: 0, max: 10 };
  if (cap.id === "number.round") return { value: 3.14159, decimals: 2 };
  if (cap.id === "time.to-iso") return 1700000000;
  if (cap.id === "time.to-unix") return "2026-01-01T00:00:00Z";
  if (cap.id === "time.diff-seconds") return { from: "2026-01-01T00:00:00Z", to: "2026-01-01T00:01:00Z" };
  if (cap.id === "encoding.base64-decode") return "UGVubnlSYWls";
  if (cap.id === "encoding.hex-decode") return "50656e6e795261696c";
  if (cap.id === "encoding.url-decode") return "hello%20world";
  if (cap.id === "dns.a") return "example.com";
  if (cap.id === "npm.latest") return "react";
  if (cap.id === "github.repo") return "x402-foundation/x402";
  if (cap.id === "fx.convert") return { amount: 1, from: "USD", to: "EUR" };
  if (cap.id === "country.lookup") return "US";
  if (cap.id === "validation.email") return "hello@example.com";
  if (cap.id === "validation.uuid") return "550e8400-e29b-41d4-a716-446655440000";
  if (h.includes("number[]")) return [1, 2, 3];
  if (h.includes("object") || h.startsWith("{")) return { value: "PennyRail" };
  if (h.includes("url")) return "https://example.com";
  return "PennyRail";
}

const TEMPLATE_PRODUCTS: RevenueProductDefinition[] = [
  {
    id: "vehicle.vin-decode",
    title: "Decode VIN",
    description: "Decode a VIN to normalized vehicle make, model, year, trim, body and plant metadata using NHTSA vPIC.",
    aliases: ["decode vin", "vin decoder", "vehicle identification number lookup", "vehicle specs from vin"],
    tier: "micro",
    inputHint: "{vin,modelYear?}",
    sampleInput: { vin: "1HGCM82633A004352", modelYear: 2003 },
    source: "template",
    template: "vin-decode",
  },
  {
    id: "security.osv-package",
    title: "Package vulnerability lookup",
    description: "Look up known vulnerabilities for an open-source package version using the OSV database.",
    aliases: ["package vulnerabilities", "osv package lookup", "dependency vulnerability check", "is package version vulnerable"],
    tier: "micro",
    inputHint: "{ecosystem,name,version}",
    sampleInput: { ecosystem: "npm", name: "lodash", version: "4.17.20" },
    source: "template",
    template: "osv-package",
  },
  {
    id: "dns.records",
    title: "DNS record lookup",
    description: "Resolve A, AAAA, MX, TXT, CNAME, NS, CAA or SRV records through DNS-over-HTTPS.",
    aliases: ["dns records", "mx lookup", "txt record lookup", "aaaa lookup", "cname lookup", "dns mx txt"],
    tier: "network",
    inputHint: "{domain,type}",
    sampleInput: { domain: "example.com", type: "MX" },
    source: "template",
    template: "dns-records",
  },
  {
    id: "batch.utility",
    title: "Batch deterministic utilities",
    description: "Run up to 10 PennyRail factory operations in one paid request and receive one result envelope.",
    aliases: ["batch utilities", "bulk deterministic transforms", "run multiple utilities", "multi tool batch", "batch text json transforms"],
    tier: "standard",
    inputHint: "{operations:[{operation,input}]} up to 10",
    sampleInput: {
      operations: [
        { operation: "text.slugify", input: "PennyRail Revenue Engine" },
        { operation: "crypto.sha256", input: "PennyRail" },
      ],
    },
    source: "template",
    template: "batch-utility",
  },
];

export function revenueProductDefinitions(): RevenueProductDefinition[] {
  const factory: RevenueProductDefinition[] = FACTORY_CAPABILITIES.map(cap => ({
    id: cap.id,
    title: cap.title,
    description: cap.description,
    aliases: unique([cap.title, ...cap.keywords]),
    tier: cap.network ? "network" : "nano",
    inputHint: cap.inputHint,
    sampleInput: sampleForCapability(cap),
    source: "factory",
    operation: cap.id,
  }));
  return [...factory, ...TEMPLATE_PRODUCTS];
}

const definitionMap = new Map(revenueProductDefinitions().map(p => [p.id, p]));

export function staticRevenueProductRoutes(): RevenueProductRoute[] {
  const routes: RevenueProductRoute[] = [];
  const seen = new Set<string>();
  for (const product of revenueProductDefinitions()) {
    for (const alias of product.aliases) {
      const slug = `${product.id}--${cleanSlug(alias)}`;
      const path = `/api/p/${product.tier}/${slug}`;
      if (seen.has(path)) continue;
      seen.add(path);
      routes.push({
        ...product,
        alias,
        slug,
        path,
        priceUsd: REVENUE_TIER_PRICE[product.tier],
        source: product.source,
      });
    }
  }
  return routes;
}

export function resolveRevenueProductSlug(slug: string, requestedTier: RevenueTier) {
  const id = decodeURIComponent(slug).split("--", 1)[0];
  const product = definitionMap.get(id);
  if (!product) throw new Error("unknown PennyRail revenue product");
  if (product.tier !== requestedTier) throw new Error("product price tier mismatch");
  return product;
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(`upstream ${new URL(url).hostname} returned HTTP ${response.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function runVinDecode(input: any) {
  const vin = asText(input?.vin ?? input).trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9*]{11,17}$/.test(vin)) throw new Error("vin must be 11-17 VIN characters (I, O and Q are not valid)");
  const modelYearRaw = input?.modelYear;
  const modelYear = modelYearRaw == null || modelYearRaw === "" ? null : Number(modelYearRaw);
  if (modelYear !== null && (!Number.isInteger(modelYear) || modelYear < 1900 || modelYear > 2100)) throw new Error("modelYear must be a plausible four-digit year");
  const query = new URLSearchParams({ format: "json" });
  if (modelYear !== null) query.set("modelyear", String(modelYear));
  const body = await fetchJson(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?${query}`, {
    headers: { "user-agent": "PennyRail/1.0 (+https://pennyrail.vercel.app)", accept: "application/json" },
  });
  const row = Array.isArray(body?.Results) ? body.Results[0] : null;
  if (!row) throw new Error("NHTSA returned no VIN result");
  return {
    vin,
    make: row.Make || null,
    model: row.Model || null,
    modelYear: row.ModelYear || modelYear,
    trim: row.Trim || null,
    series: row.Series || null,
    vehicleType: row.VehicleType || null,
    bodyClass: row.BodyClass || null,
    driveType: row.DriveType || null,
    fuelType: row.FuelTypePrimary || null,
    engineCylinders: row.EngineCylinders || null,
    displacementLiters: row.DisplacementL || null,
    plantCity: row.PlantCity || null,
    plantState: row.PlantState || null,
    plantCountry: row.PlantCountry || null,
    manufacturer: row.Manufacturer || row.ManufacturerName || null,
    errorCode: row.ErrorCode || null,
    errorText: row.ErrorText || null,
    source: "NHTSA vPIC",
  };
}

async function runOsvPackage(input: any) {
  const ecosystem = asText(input?.ecosystem).trim();
  const name = asText(input?.name).trim();
  const version = asText(input?.version).trim();
  if (!ecosystem || !name || !version) throw new Error("ecosystem, name and version are required");
  const body = await fetchJson("https://api.osv.dev/v1/query", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ package: { ecosystem, name }, version }),
  });
  const vulns = Array.isArray(body?.vulns) ? body.vulns : [];
  return {
    package: { ecosystem, name, version },
    vulnerabilityCount: vulns.length,
    vulnerabilities: vulns.map((v: any) => ({
      id: v.id,
      summary: v.summary || null,
      details: typeof v.details === "string" ? v.details.slice(0, 2000) : null,
      aliases: Array.isArray(v.aliases) ? v.aliases : [],
      modified: v.modified || null,
      published: v.published || null,
      references: Array.isArray(v.references) ? v.references.slice(0, 12) : [],
    })),
    source: "OSV.dev",
  };
}

async function runDnsRecords(input: any) {
  const domain = asText(input?.domain ?? input?.name ?? input).trim().replace(/\.$/, "");
  const type = asText(input?.type ?? "A").trim().toUpperCase();
  const allowed = new Set(["A", "AAAA", "MX", "TXT", "CNAME", "NS", "CAA", "SRV"]);
  if (!/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$/.test(domain)) throw new Error("invalid domain");
  if (!allowed.has(type)) throw new Error("type must be A, AAAA, MX, TXT, CNAME, NS, CAA or SRV");
  const body = await fetchJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  return {
    domain,
    type,
    status: body?.Status,
    answers: Array.isArray(body?.Answer) ? body.Answer.map((x: any) => ({ name: x.name, type: x.type, ttl: x.TTL, data: x.data })) : [],
    authority: Array.isArray(body?.Authority) ? body.Authority.map((x: any) => ({ name: x.name, type: x.type, ttl: x.TTL, data: x.data })) : [],
    source: "Cloudflare DNS-over-HTTPS",
  };
}

async function runBatchUtility(input: any) {
  const operations = Array.isArray(input?.operations) ? input.operations : [];
  if (!operations.length || operations.length > 10) throw new Error("operations must contain 1-10 items");
  const known = new Set(FACTORY_CAPABILITIES.map(c => c.id));
  const results = [];
  for (let i = 0; i < operations.length; i++) {
    const row = operations[i];
    const operation = asText(row?.operation).trim();
    if (!known.has(operation)) {
      results.push({ index: i, operation, ok: false, error: "unknown operation" });
      continue;
    }
    try {
      results.push({ index: i, operation, ok: true, result: await runFactoryOperation(operation, row?.input) });
    } catch (error) {
      results.push({ index: i, operation, ok: false, error: error instanceof Error ? error.message : "operation failed" });
    }
  }
  return { count: results.length, succeeded: results.filter(x => x.ok).length, failed: results.filter(x => !x.ok).length, results };
}

export async function runRevenueProduct(slug: string, tier: RevenueTier, input: any) {
  const product = resolveRevenueProductSlug(slug, tier);
  let result: any;
  if (product.source === "factory" && product.operation) result = await runFactoryOperation(product.operation, input);
  else if (product.template === "vin-decode") result = await runVinDecode(input);
  else if (product.template === "osv-package") result = await runOsvPackage(input);
  else if (product.template === "dns-records") result = await runDnsRecords(input);
  else if (product.template === "batch-utility") result = await runBatchUtility(input);
  else throw new Error("unsupported revenue product");
  return {
    product: product.id,
    title: product.title,
    priceUsd: REVENUE_TIER_PRICE[product.tier],
    result,
  };
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function rowsFromWishes(payload: any): AnyRow[] {
  const candidates = [
    payload?.radar,
    payload?.clusters,
    payload?.wishes,
    payload?.items,
    payload?.results,
    payload?.data?.radar,
    payload?.data?.clusters,
    payload?.data?.wishes,
    payload?.data?.items,
    payload?.data?.results,
    payload?.aggregate?.radar,
    payload?.aggregate?.clusters,
  ];
  return candidates.find(Array.isArray) || [];
}

function demandSignalType(row: AnyRow) {
  if (typeof row?.signalType === "string") return row.signalType;
  const s = row?.sources || {};
  const api = Number(s.api || 0);
  const mcp = Number(s.mcp || 0);
  const miss = Number(s["find-miss"] || s.findMiss || 0);
  const total = api + mcp + miss;
  if (!total) return "mixed";
  if (miss / total >= 2 / 3) return "discoverability";
  if ((api + mcp) / total >= 2 / 3) return "explicit-request";
  return "mixed";
}

function looksNoisy(text: string) {
  const t = text.trim().toLowerCase();
  return t === "test" || t === "ping" || t === "heartbeat" || t.includes("probe-test") || t.includes("launch check");
}

function marketService(row: any): MarketService {
  const traction = row?.assessment?.traction || {};
  return {
    slug: asText(row?.slug),
    name: asText(row?.name),
    description: asText(row?.description),
    category: asText(row?.category || "Other"),
    minPriceUsd: Number.isFinite(Number(row?.min_price_usd)) ? Number(row.min_price_usd) : null,
    volumeUsd30d: Number(traction?.volume_usd_30d || 0),
    txCount30d: Number(traction?.tx_count_30d || 0),
    buyers30d: Number(traction?.unique_buyers_30d || 0),
    topBuyerShare30d: Number.isFinite(Number(traction?.top_buyer_share_30d)) ? Number(traction.top_buyer_share_30d) : null,
    trend7dVs30d: Number.isFinite(Number(traction?.trend_7d_vs_30d)) ? Number(traction.trend_7d_vs_30d) : null,
  };
}

async function fetchX402ListServices() {
  const first = await fetchJson("https://x402-list.com/api/v1/services?status=online&payment_ready=true&per_page=100&page=1");
  const rows = Array.isArray(first?.data) ? first.data : [];
  const totalPages = Math.max(1, Math.min(8, Number(first?.meta?.total_pages || 1)));
  if (totalPages > 1) {
    const more = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(page =>
      fetchJson(`https://x402-list.com/api/v1/services?status=online&payment_ready=true&per_page=100&page=${page}`)
        .catch(() => ({ data: [] }))
    ));
    for (const page of more) if (Array.isArray(page?.data)) rows.push(...page.data);
  }
  return rows.map(marketService);
}

function supplyStats(need: string, services: MarketService[]) {
  const words = normalize(need).split(" ").filter(w => w.length >= 4);
  if (!words.length) return { count: 0, volumeUsd30d: 0, buyers30d: 0, top: [] as MarketService[] };
  const matches: MarketService[] = [];
  for (const service of services) {
    const hay = normalize(`${service.name} ${service.description} ${service.category}`);
    const hits = words.filter(w => hay.includes(w)).length;
    if (hits >= Math.max(1, Math.ceil(words.length * 0.5))) matches.push(service);
  }
  matches.sort((a,b)=>b.volumeUsd30d-a.volumeUsd30d || b.buyers30d-a.buyers30d);
  return {
    count: matches.length,
    volumeUsd30d: Number(matches.reduce((sum,s)=>sum+s.volumeUsd30d,0).toFixed(4)),
    buyers30d: matches.reduce((sum,s)=>sum+s.buyers30d,0),
    top: matches.slice(0,3),
  };
}

function templateMatch(need: string) {
  const n = normalize(need);
  let best: { product: RevenueProductDefinition; score: number } | null = null;
  for (const product of TEMPLATE_PRODUCTS) {
    let score = 0;
    for (const alias of product.aliases) {
      const words = normalize(alias).split(" ").filter(Boolean);
      const hits = words.filter(w => n.includes(w)).length;
      if (n.includes(normalize(alias))) score += 12 + words.length;
      else if (hits / Math.max(1, words.length) >= 0.5) score += hits * 2;
    }
    if (!best || score > best.score) best = { product, score };
  }
  return best && best.score >= 3 ? best : null;
}

function resolveNeedProduct(need: string) {
  const template = templateMatch(need);
  const factory = matchCapability(need);
  if (template && (!factory || template.score > factory.score + 2)) return { product: template.product, score: template.score };
  if (factory) return { product: definitionMap.get(factory.capability.id)!, score: factory.score };
  return null;
}

export function resolveRevenueNeed(need: string) {
  return resolveNeedProduct(need);
}

function categoryRollup(services: MarketService[]) {
  const map = new Map<string, { category: string; services: number; volumeUsd30d: number; txCount30d: number; buyers30d: number; priceSum: number; priced: number }>();
  for (const service of services) {
    const key = service.category || "Other";
    const row = map.get(key) || { category: key, services: 0, volumeUsd30d: 0, txCount30d: 0, buyers30d: 0, priceSum: 0, priced: 0 };
    row.services++;
    row.volumeUsd30d += service.volumeUsd30d;
    row.txCount30d += service.txCount30d;
    row.buyers30d += service.buyers30d;
    if (service.minPriceUsd !== null) { row.priceSum += service.minPriceUsd; row.priced++; }
    map.set(key, row);
  }
  return [...map.values()].map(row => ({
    category: row.category,
    services: row.services,
    volumeUsd30d: Number(row.volumeUsd30d.toFixed(4)),
    txCount30d: row.txCount30d,
    buyers30d: row.buyers30d,
    avgMinPriceUsd: row.priced ? Number((row.priceSum / row.priced).toFixed(5)) : null,
    volumePerServiceUsd30d: row.services ? Number((row.volumeUsd30d / row.services).toFixed(4)) : 0,
    buyersPerService30d: row.services ? Number((row.buyers30d / row.services).toFixed(3)) : 0,
  })).sort((a, b) => b.volumeUsd30d - a.volumeUsd30d || b.buyers30d - a.buyers30d);
}

type BestsellerRow = {
  rank: number;
  slug: string;
  sales: number;
  revenueUsd: number;
  buyers: number;
  organicScore: number;
  avgTicketUsd: number;
  deltaSales: number;
  trend: string;
};

async function responseJson(response: Response) {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}: ${typeof body === "string" ? body.slice(0,200) : JSON.stringify(body).slice(0,300)}`);
  return body;
}

async function fetchPaidAgent402Intelligence() {
  const out: { demandRadar: any; bestsellers: any; spendUsd: number; errors: string[] } = {
    demandRadar: null,
    bestsellers: null,
    spendUsd: 0,
    errors: [],
  };
  try {
    const payFetch = await paidFetchBaseUsdcCapped(0.005);
    try {
      const response = await payFetch("https://agent402.tools/api/demand-radar?sort=count&limit=50&minCount=1", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      out.demandRadar = await responseJson(response);
      out.spendUsd += 0.005;
    } catch (error) {
      out.errors.push(`demand-radar: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      const response = await payFetch("https://agent402.tools/api/bestsellers?days=30&sort=buyers&limit=50", {
        method: "GET",
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      out.bestsellers = await responseJson(response);
      out.spendUsd += 0.005;
    } catch (error) {
      out.errors.push(`bestsellers: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    out.errors.push(`buyer: ${error instanceof Error ? error.message : String(error)}`);
  }
  return out;
}

function bestsellerRows(payload: any): BestsellerRow[] {
  const rows = Array.isArray(payload?.bestsellers) ? payload.bestsellers : [];
  return rows.map((row: any, i: number) => ({
    rank: Number(row?.rank || i + 1),
    slug: asText(row?.slug).trim(),
    sales: Number(row?.sales || 0),
    revenueUsd: Number(row?.revenueUsd || 0),
    buyers: Number(row?.buyers || 0),
    organicScore: Number(row?.organicScore || 0),
    avgTicketUsd: Number(row?.avgTicketUsd || 0),
    deltaSales: Number(row?.deltaSales || 0),
    trend: asText(row?.trend || ""),
  })).filter((row: BestsellerRow) => row.slug);
}

type Agent402CatalogEndpoint = { slug?: string; name?: string; description?: string; category?: string; price?: string; path?: string };

function agent402CatalogMap(payload: any) {
  const rows: Agent402CatalogEndpoint[] = Array.isArray(payload?.endpoints) ? payload.endpoints : [];
  return new Map(rows.map((row) => [asText(row?.slug).trim(), row] as const).filter(([slug]) => Boolean(slug)));
}

function bestsellerNeed(row: BestsellerRow, catalog: Map<string, Agent402CatalogEndpoint>) {
  const item = catalog.get(row.slug);
  if (!item) return row.slug.replace(/[-_.]+/g, " ").trim();
  return `${asText(item.name)} — ${asText(item.description)}`.trim();
}

function bestsellerMatchText(row: BestsellerRow, catalog: Map<string, Agent402CatalogEndpoint>) {
  const item = catalog.get(row.slug);
  return item ? `${asText(item.name)} ${row.slug}`.trim() : row.slug.replace(/[-_.]+/g, " ").trim();
}

function bestsellerScore(row: BestsellerRow) {
  let score = 25;
  score += Math.min(40, row.buyers * 5);
  score += Math.min(24, Math.log2(Math.max(1, row.sales)) * 5);
  score += Math.min(18, row.revenueUsd * 18);
  if (row.trend === "rising" || row.trend === "new") score += 12;
  if (row.organicScore >= 0.4) score += 8;
  return Math.round(score);
}

export async function runRevenueAudit() {
  const [wishesResult, servicesResult, paidIntelResult, pricingResult] = await Promise.allSettled([
    fetchJson("https://agent402.tools/api/wishes"),
    fetchX402ListServices(),
    fetchPaidAgent402Intelligence(),
    fetchJson("https://agent402.tools/api/pricing"),
  ]);

  const wishes = wishesResult.status === "fulfilled" ? wishesResult.value : {};
  const services: MarketService[] = servicesResult.status === "fulfilled" ? servicesResult.value as MarketService[] : [];
  const paidIntel = paidIntelResult.status === "fulfilled"
    ? paidIntelResult.value
    : { demandRadar: null, bestsellers: null, spendUsd: 0, errors: ["paid intelligence call failed"] };
  const agent402Pricing = pricingResult.status === "fulfilled" ? pricingResult.value : {};
  const agent402Catalog = agent402CatalogMap(agent402Pricing);

  // Agent402 intentionally changed public /api/wishes into an aggregate beacon.
  // Detailed cluster text is strategic intel and now lives behind the $0.005
  // demand-radar endpoint. Prefer that paid feed; retain the free parser only
  // as a backwards-compatible fallback if detailed rows ever reappear.
  const paidDemandRows = rowsFromWishes(paidIntel.demandRadar);
  const freeDemandRows = rowsFromWishes(wishes);
  const rawDemandRows = paidDemandRows.length ? paidDemandRows : freeDemandRows;
  const rows = rawDemandRows
    .map((r: AnyRow) => ({ ...r, text: asText(r?.text ?? r?.query ?? r?.wish).trim() }))
    .filter((r: AnyRow) => r.text && !Boolean(r.noise) && !looksNoisy(r.text))
    .sort((a: AnyRow, b: AnyRow) => Number(b.count || 1) - Number(a.count || 1))
    .slice(0, 100);

  const dynamicRoutes: RevenueProductRoute[] = [];
  const demandOpportunities = rows.map((row: AnyRow) => {
    const text = row.text;
    const count = Math.max(1, Number(row.count || 1));
    const signalType = demandSignalType(row);
    const supply = supplyStats(text, services);
    const supplyMatches = supply.count;
    const resolved = resolveNeedProduct(text);
    const nearThreshold = Boolean(row.nearThreshold) || Number(row.gapToThreshold ?? 99) <= 2;
    const ageMs = Date.now() - Date.parse(asText(row.lastSeen || row.last_seen || ""));
    const recent = Number.isFinite(ageMs) ? ageMs <= 7 * 86_400_000 : false;

    let score = count * 12;
    score += signalType === "explicit-request" ? 24 : signalType === "mixed" ? 10 : -12;
    if (nearThreshold) score += 15;
    if (recent) score += 10;
    score += supplyMatches === 0 ? 24 : supplyMatches === 1 ? 12 : supplyMatches <= 3 ? 3 : -8;
    if (supply.volumeUsd30d >= 100) score += 12;
    else if (supply.volumeUsd30d >= 10) score += 7;
    else if (supply.buyers30d >= 5) score += 4;
    if (resolved) score += 24;

    let action: "AUTO-LIVE" | "DISCOVERY" | "NEEDS-PRIMITIVE" | "IGNORE" = "IGNORE";
    if (resolved && signalType !== "discoverability" && score >= 30) action = "AUTO-LIVE";
    else if (resolved) action = "DISCOVERY";
    else if (signalType !== "discoverability" && score >= 28) action = "NEEDS-PRIMITIVE";

    let productRoute: RevenueProductRoute | null = null;
    if (resolved && (action === "AUTO-LIVE" || action === "DISCOVERY")) {
      const product = resolved.product;
      const alias = text;
      const slug = `${product.id}--${cleanSlug(text)}`;
      productRoute = {
        ...product,
        alias,
        slug,
        path: `/api/p/${product.tier}/${slug}`,
        priceUsd: REVENUE_TIER_PRICE[product.tier],
        source: "demand",
        demand: { text, count, score, signalType, supplyMatches },
      };
      dynamicRoutes.push(productRoute as RevenueProductRoute);
    }

    return {
      source: "demand-radar",
      action,
      score,
      need: text,
      demandSignals: count,
      signalType,
      nearThreshold,
      supplyMatches,
      supplyRevenueUsd30d: supply.volumeUsd30d,
      supplyBuyers30d: supply.buyers30d,
      topSupply: supply.top.map(s=>({slug:s.slug,name:s.name,category:s.category,volumeUsd30d:s.volumeUsd30d,buyers30d:s.buyers30d,minPriceUsd:s.minPriceUsd})),
      matchedProduct: resolved ? {
        id: resolved.product.id,
        title: resolved.product.title,
        tier: resolved.product.tier,
        priceUsd: REVENUE_TIER_PRICE[resolved.product.tier],
        matchScore: resolved.score,
        path: productRoute?.path || null,
      } : null,
    };
  });

  // Bestsellers are a second, independent signal: actual distinct paying
  // wallets and per-tool sales. This prevents the factory from becoming blind
  // whenever the unmet-demand board is quiet or changes shape.
  const bestRows = bestsellerRows(paidIntel.bestsellers);
  const bestsellerOpportunities = bestRows.map((row) => {
    const need = bestsellerNeed(row, agent402Catalog);
    const matchText = bestsellerMatchText(row, agent402Catalog);
    const resolved = resolveNeedProduct(matchText);
    const score = bestsellerScore(row);
    let action: "AUTO-LIVE" | "NEEDS-PRIMITIVE" = resolved ? "AUTO-LIVE" : "NEEDS-PRIMITIVE";
    let productRoute: RevenueProductRoute | null = null;
    if (resolved) {
      const product = resolved.product;
      const alias = `${need} paid demand`;
      const slug = `${product.id}--proven-${cleanSlug(row.slug)}`;
      productRoute = {
        ...product,
        alias,
        slug,
        path: `/api/p/${product.tier}/${slug}`,
        priceUsd: REVENUE_TIER_PRICE[product.tier],
        source: "demand",
        demand: { text: need, count: Math.max(1, row.sales), score, signalType: "paid-bestseller", supplyMatches: 1 },
      };
      dynamicRoutes.push(productRoute);
    }
    return {
      source: "paid-bestsellers",
      action,
      score,
      need,
      bestseller: row,
      matchedProduct: resolved ? {
        id: resolved.product.id,
        title: resolved.product.title,
        tier: resolved.product.tier,
        priceUsd: REVENUE_TIER_PRICE[resolved.product.tier],
        matchScore: resolved.score,
        path: productRoute?.path || null,
      } : null,
    };
  });

  const opportunities = [...demandOpportunities, ...bestsellerOpportunities]
    .sort((a: any, b: any) => b.score - a.score);

  const staticRoutes = staticRevenueProductRoutes();
  const routeMap = new Map<string, RevenueProductRoute>();
  for (const route of [...staticRoutes, ...dynamicRoutes]) routeMap.set(route.path, route);
  const allRoutes = [...routeMap.values()];

  const topServices = [...services]
    .sort((a, b) => b.volumeUsd30d - a.volumeUsd30d || b.buyers30d - a.buyers30d)
    .slice(0, 20);

  const publicWishIsBeaconOnly = Boolean(wishes && typeof wishes === "object" &&
    Number.isFinite(Number(wishes?.distinctClusters)) && freeDemandRows.length === 0);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: "REVENUE_MULTIPLIER_V34",
    sources: {
      agent402Wishes: wishesResult.status === "fulfilled" ? (publicWishIsBeaconOnly ? "beacon-only" : "ok") : "unavailable",
      agent402DemandRadar: paidDemandRows.length ? "ok-paid" : "unavailable",
      agent402Bestsellers: bestRows.length ? "ok-paid" : "unavailable",
      agent402Pricing: pricingResult.status === "fulfilled" ? "ok-free" : "unavailable",
      x402List: servicesResult.status === "fulfilled" ? "ok" : "unavailable",
      demandRowsExtracted: rows.length,
      bestsellerRowsExtracted: bestRows.length,
      intelligenceErrors: paidIntel.errors,
    },
    market: {
      servicesObserved: services.length,
      measuredVolumeUsd30d: Number(services.reduce((sum, s) => sum + s.volumeUsd30d, 0).toFixed(4)),
      measuredTransactions30d: services.reduce((sum, s) => sum + s.txCount30d, 0),
      measuredBuyers30d: services.reduce((sum, s) => sum + s.buyers30d, 0),
      categories: categoryRollup(services),
      topServices,
      caveat: "x402 List traction is a partial measured sample, not total x402 market volume. Paid Agent402 demand/bestseller signals are evaluated independently.",
    },
    portfolio: {
      baseFactoryCapabilities: FACTORY_CAPABILITIES.length,
      templateProducts: TEMPLATE_PRODUCTS.length,
      staticRevenueRoutes: staticRoutes.length,
      demandAliasesLive: dynamicRoutes.length,
      totalRevenueRoutesLive: allRoutes.length,
      nanoRoutes: allRoutes.filter(r => r.tier === "nano").length,
      networkRoutes: allRoutes.filter(r => r.tier === "network").length,
      microRoutes: allRoutes.filter(r => r.tier === "micro").length,
      standardRoutes: allRoutes.filter(r => r.tier === "standard").length,
    },
    opportunities: opportunities.slice(0, 100),
    unresolved: opportunities.filter((x: any) => x.action === "NEEDS-PRIMITIVE").slice(0, 40),
    autoLive: opportunities.filter((x: any) => x.action === "AUTO-LIVE").slice(0, 50),
    productRoutes: allRoutes,
    paidDemand: {
      demandRadar: paidIntel.demandRadar ? {
        totalWishes: paidIntel.demandRadar?.totalWishes ?? null,
        distinctClusters: paidIntel.demandRadar?.distinctClusters ?? null,
        matchedClusters: paidIntel.demandRadar?.matchedClusters ?? null,
        buildThreshold: paidIntel.demandRadar?.buildThreshold ?? null,
      } : null,
      bestsellerTotals: paidIntel.bestsellers?.totals ?? null,
      bestsellers: bestRows,
    },
    economics: {
      objective: "maximize aggregate machine-commerce gross profit across many tiny transactions",
      targetDailyRevenueUsd: 1000,
      targetMonthlyRevenueUsd: 30000,
      priceFloorUsd: 0.001,
      priceTiersUsd: REVENUE_TIER_PRICE,
      intelligenceSpendUsdThisAudit: paidIntel.spendUsd,
      intelligenceSpendCapUsdPerAudit: 0.01,
      cacheHours: 6,
      worstCaseIntelSpendUsdPerDay: 0.04,
      worstCaseIntelSpendUsdPer30d: 1.2,
      note: "v34 buys Agent402 demand-radar + bestsellers with a hard $0.005 cap per call. Public /api/wishes is now intentionally aggregate-only, so detailed gap discovery requires the paid feed.",
    },
  };
}
