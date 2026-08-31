import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";
import { staticRevenueProductRoutes, type RevenueProductRoute } from "@/lib/revenue-engine";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { BAZAAR_WEB_SEARCH_PATH } from "@/lib/x402-bazaar";

export const dynamic = "force-dynamic";

function cleanOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

const DEMAND_FRONTDOORS = [
  {
    path: "/api/agent/hash",
    priceUsd: 0.001,
    description: "SHA-256 SHA-512 SHA-1 MD5 hashing and encoding; hex and base64 digests.",
    intents: ["hash", "hashing", "sha256", "sha512", "sha-256", "sha-512", "cryptographic hash", "digest"],
  },
  {
    path: "/api/agent/base64-decode",
    priceUsd: 0.001,
    description: "Base64 decoding for agent workflows.",
    intents: ["base64", "base64 decode", "decode base64", "encoding"],
  },
  {
    path: "/api/agent/hex-decode",
    priceUsd: 0.001,
    description: "Hexadecimal decoding for agent workflows.",
    intents: ["hex", "hex decode", "decode hex", "encoding"],
  },
  {
    path: "/api/agent/fx-convert",
    priceUsd: 0.001,
    description: "Current FX currency conversion and financial data utility.",
    intents: ["fx", "currency conversion", "exchange rate", "financial data", "convert currency"],
  },
  {
    path: "/api/agent/token-count",
    priceUsd: 0.001,
    description: "Exact LLM BPE token counting for context budgets.",
    intents: ["token count", "count tokens", "llm tokens", "context tokens", "bpe tokens"],
  },
  {
    path: "/api/agent/page-metadata",
    priceUsd: 0.002,
    description: "Web page and article metadata extraction.",
    intents: ["page metadata", "article metadata", "open graph", "website metadata", "url metadata"],
  },
  {
    path: "/api/agent/chat-mini",
    priceUsd: 0.02,
    description: "Low-cost OpenAI-compatible GPT-4o-mini inference and chat completion.",
    intents: ["inference", "chat completion", "gpt-4o-mini", "openai chat", "agent chat"],
  },
  {
    path: "/api/agent/block-number",
    priceUsd: 0.001,
    description: "Latest EVM block number and crypto onchain read.",
    intents: ["block number", "latest block", "evm block", "onchain read", "crypto data"],
  },
];

export async function GET(req: NextRequest) {
  const origin = cleanOrigin(req);
  const mainnet = process.env.X402_MODE?.trim() === "mainnet";
  const payTo = process.env.PENNYRAIL_PAY_TO || "";
  const network = mainnet ? "eip155:8453" : "eip155:84532";
  const revenueAudit = await getCachedRevenueAudit();
  const revenueRoutes: RevenueProductRoute[] = Array.isArray(revenueAudit.productRoutes) && revenueAudit.productRoutes.length
    ? revenueAudit.productRoutes as RevenueProductRoute[]
    : staticRevenueProductRoutes();

  const routerTiers = ["nano","mini","network","micro","intel","standard","premium","skill","analyst"];

  return NextResponse.json({
    spec: "agent402-service-manifest/1",
    x402Version: 2,
    version: 3,
    name: "PennyRail",
    summary: "Cheap agent transaction router optimized for repeated paid calls: hashing, encoding, FX, token counting, page metadata, inference, onchain reads and live web search.",
    homepage: origin,
    resources: [
      // Exact-match acquisition front doors come first so active routers see
      // what PennyRail actually sells instead of generic wildcard metadata.
      ...DEMAND_FRONTDOORS.map(item => `${origin}${item.path}`),
      `${origin}${BAZAAR_WEB_SEARCH_PATH}`,
      `${origin}/api/tools/json-canonicalize`,
      `${origin}/api/tools/text-stats`,
      `${origin}/api/tools/strip-tracking`,
      ...FACTORY_CAPABILITIES.map(c => `${origin}/api/f/${c.id}`),
      ...revenueRoutes.map(p => `${origin}${p.path}`),
      ...routerTiers.map(tier => `${origin}/api/router/execute/${tier}`),
    ],
    payment: {
      x402: {
        version: 2,
        currency: "USDC",
        networks: [network],
        primaryNetwork: network,
        priceRange: "$0.001-$0.20",
        payTo,
        payToName: "PennyRail",
        nonCustodial: true,
      },
    },
    capabilities: {
      tools: FACTORY_CAPABILITIES.length + 12 + revenueRoutes.length + routerTiers.length,
      categories: [
        { key: "hashing-encoding", label: "Hashing and encoding", tools: 3, priceRange: "$0.001" },
        { key: "financial-data", label: "FX and market utilities", tools: 1, priceRange: "$0.001" },
        { key: "agent-utilities", label: "Token counting and page metadata", tools: 2, priceRange: "$0.001-$0.002" },
        { key: "inference", label: "Low-cost inference", tools: 1, priceRange: "$0.02" },
        { key: "onchain", label: "Crypto and onchain reads", tools: 1, priceRange: "$0.001" },
        { key: "search", label: "Live web search and cited answers", tools: 1, priceRange: "$0.02" },
        { key: "router", label: "Universal intent router execution tiers", tools: routerTiers.length, priceRange: "$0.001-$0.20" },
        { key: "utility", label: "Core deterministic utilities", tools: FACTORY_CAPABILITIES.length + 3, priceRange: "$0.001" },
        { key: "revenue-engine", label: "Demand-aligned autonomous products", tools: revenueRoutes.length, priceRange: "$0.001-$0.20" },
      ],
    },
    routing: {
      featured: [
        ...DEMAND_FRONTDOORS.map(item => ({
          resource: `${origin}${item.path}`,
          method: "POST",
          priceUsd: item.priceUsd,
          intents: item.intents,
          description: item.description,
        })),
        {
          resource: `${origin}${BAZAAR_WEB_SEARCH_PATH}`,
          method: "POST",
          priceUsd: 0.02,
          intents: [
            "web search",
            "search the web",
            "live web search",
            "current information",
            "latest information",
            "current events",
            "latest news",
            "research",
            "fresh sources",
            "grounded answer with sources",
          ],
          description: "Live web search for AI agents. Returns a grounded answer plus current sources for research, current events, news and up-to-date information.",
        },
      ],
    },
    discovery: {
      spec: "x402-discovery/1",
      openapi: `${origin}/openapi.json`,
      router: {
        find: `${origin}/api/router/find`,
        quote: `${origin}/api/router/quote`,
        executePattern: `${origin}/api/router/execute/{tier}`,
        guidance: "Discovery and quote are free. Exact-match front doors are available for common high-frequency agent jobs.",
      },
    },
    mcp: {
      remoteConnector: `${origin}/api/mcp`,
      package: null,
    },
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
