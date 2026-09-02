import { createHash } from "node:crypto";
import { payTo } from "@/lib/x402-server";
import { revenueProductDefinitions } from "@/lib/revenue-engine";

type CatalogProduct = {
  id: string;
  alias: string;
  title: string;
  description: string;
  path: string;
  priceUsd: number;
  tier: string;
  demand?: { score?: number; observedSales?: number } | null;
};

type GatefarePublished = { slug?: string; urlName?: string; name?: string; targetUrl?: string };

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

function gatefareBase() {
  return (process.env.GATEFARE_BASE_URL?.trim() || "https://gatefare.io").replace(/\/$/, "");
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 44);
}

export function distributorSecret() {
  const seed =
    process.env.RADAR_ADMIN_TOKEN?.trim() ||
    process.env.CDP_WALLET_SECRET?.trim() ||
    process.env.CDP_API_KEY_SECRET?.trim() ||
    "";
  if (!seed) return "";
  return createHash("sha256").update(`pennyrail-v65-distributor:${seed}`).digest("hex");
}

async function gatefare(path: string, init: RequestInit = {}) {
  const pat = process.env.GATEFARE_PAT?.trim();
  if (!pat) throw new Error("GATEFARE_PAT is not configured");
  const response = await fetch(`${gatefareBase()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${pat}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    throw new Error(`Gatefare ${path} HTTP ${response.status}: ${String(text).slice(0, 240)}`);
  }
  return body;
}

export async function loadPennyRailCatalog(): Promise<CatalogProduct[]> {
  const response = await fetch(`${origin()}/api/revenue/catalog`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`PennyRail catalog HTTP ${response.status}`);
  const body = await response.json();
  return Array.isArray(body?.products) ? body.products : [];
}

export async function syncGatefareExistingProducts(maxNew = 3) {
  const pat = process.env.GATEFARE_PAT?.trim();
  const secret = distributorSecret();
  const wallet = String(payTo || "").trim();
  if (!pat) return { configured: false, attempted: 0, published: 0, skipped: 0, errors: [] as string[] };
  if (!secret) return { configured: true, attempted: 0, published: 0, skipped: 0, errors: ["portfolio distributor secret unavailable"] };
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return { configured: true, attempted: 0, published: 0, skipped: 0, errors: ["seller wallet is not configured"] };
  }

  const [catalog, mineRaw] = await Promise.all([loadPennyRailCatalog(), gatefare("/api/publisher/apis")]);
  const mine: GatefarePublished[] = Array.isArray(mineRaw) ? mineRaw : Array.isArray(mineRaw?.apis) ? mineRaw.apis : [];
  const known = new Set(mine.flatMap(row => [row.slug, row.urlName].filter(Boolean).map(v => String(v))));

  const definitions = new Map(revenueProductDefinitions().map(p => [p.id, p] as const));
  const ranked = catalog
    .filter(p => {
      const def = definitions.get(p?.id);
      return p?.id && p?.title && p?.tier && Number(p?.priceUsd) > 0 && def && !(def.requiresEnv || []).length;
    })
    .sort((a, b) => {
      const bd = Number(b.demand?.observedSales || 0) * 100 + Number(b.demand?.score || 0);
      const ad = Number(a.demand?.observedSales || 0) * 100 + Number(a.demand?.score || 0);
      return bd - ad || Number(b.priceUsd) - Number(a.priceUsd);
    });

  let attempted = 0;
  let published = 0;
  let skipped = 0;
  const errors: string[] = [];
  const publishedSlugs: string[] = [];

  for (const product of ranked) {
    if (published >= maxNew) break;
    const urlName = `pennyrail-${safeSlug(product.alias || product.id)}`.slice(0, 50);
    if (known.has(urlName)) { skipped += 1; continue; }
    attempted += 1;
    const tier = encodeURIComponent(String(product.tier));
    const slug = encodeURIComponent(String(product.id));
    const targetUrl = `${origin()}/api/portfolio/fulfill/${tier}/${slug}`;
    try {
      await gatefare("/api/publisher/apis", {
        method: "POST",
        body: JSON.stringify({
          urlName,
          name: product.title.slice(0, 80),
          targetUrl,
          price: Number(product.priceUsd).toFixed(6).replace(/0+$/, "").replace(/\.$/, ""),
          ownerWallet: wallet,
          network: "eip155:8453",
          description: String(product.description || "PennyRail machine service").slice(0, 200),
          categories: ["ai-agents", "data"],
          tags: ["pennyrail", "x402", "api"],
          headers: { "x-pennyrail-distributor": secret },
        }),
      });
      published += 1;
      publishedSlugs.push(urlName);
      known.add(urlName);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { configured: true, attempted, published, skipped, existing: mine.length, publishedSlugs, errors: errors.slice(0, 3) };
}

export async function gatefareRevenue(days = 30) {
  if (!process.env.GATEFARE_PAT?.trim()) return { configured: false, revenueUsd: 0, products: 0 };
  const mineRaw = await gatefare("/api/publisher/apis");
  const mine: GatefarePublished[] = Array.isArray(mineRaw) ? mineRaw : Array.isArray(mineRaw?.apis) ? mineRaw.apis : [];
  let revenueUsd = 0;
  let checked = 0;
  const errors: string[] = [];
  for (const row of mine.slice(0, 12)) {
    const slug = String(row.slug || row.urlName || "");
    if (!slug) continue;
    try {
      const r = await gatefare(`/api/publisher/apis/${encodeURIComponent(slug)}/revenue?days=${days}`);
      const value = Number(r?.totalRevenueUsd ?? r?.total_revenue_usd ?? r?.total ?? 0);
      if (Number.isFinite(value)) revenueUsd += value;
      checked += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { configured: true, revenueUsd: Number(revenueUsd.toFixed(6)), products: mine.length, checked, errors: errors.slice(0, 3) };
}
