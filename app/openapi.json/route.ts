import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function origin(req: NextRequest) {
  return (process.env.PENNYRAIL_PUBLIC_URL?.trim() || req.nextUrl.origin).replace(/\/$/, "");
}

const paid = (summary: string, description: string, price: string, tags: string[], example: unknown) => ({
  post: {
    summary,
    description,
    tags,
    "x-price": `$${price}`,
    "x-payment-info": {
      price: { mode: "fixed", currency: "USD", amount: price },
      protocols: [{ x402: {} }],
    },
    "x-pennyrail-intents": tags,
    requestBody: {
      required: false,
      content: {
        "application/json": {
          schema: { type: "object", additionalProperties: true },
          example,
        },
      },
    },
    responses: {
      "200": { description: "Successful paid PennyRail result" },
      "400": { description: "Invalid input" },
      "402": { description: "Payment Required — x402 USDC on Base mainnet" },
    },
  },
});

export async function GET(req: NextRequest) {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "PennyRail — Pay-per-call tools for AI agents",
      version: "0.40.4",
      description:
        "PennyRail sells cheap x402 machine services to AI agents: SHA-256/SHA-512 hashing, Base64 and hex decoding, currency/FX conversion, exact LLM token counting, page/article metadata, low-cost GPT-4o-mini inference, EVM block data, and live web search with sources. Free FIND and QUOTE; pay only for execution.",
      "x-agent-summary":
        "Use PennyRail for repeated low-cost machine calls. Exact-match endpoints are preferred for common tasks; use the free universal router for everything else.",
      "x-payment-protocol": "x402",
      "x-network": "eip155:8453",
      "x-currency": "USDC",
      "x-keywords": [
        "sha256", "sha-256", "sha512", "hash", "hashing",
        "base64", "decode base64", "hex decode", "encoding",
        "currency conversion", "fx", "exchange rate", "financial data",
        "token count", "llm token count", "bpe",
        "page metadata", "article metadata", "open graph",
        "gpt-4o-mini", "chat completion", "inference",
        "evm block number", "crypto data", "onchain",
        "web search", "live web search", "latest news", "current information",
        "research", "grounded answer", "sources"
      ],
    },
    servers: [{ url: origin(req) }],
    tags: [
      { name: "hashing", description: "Cryptographic hashing and digest utilities" },
      { name: "encoding", description: "Base64 and hexadecimal decoding" },
      { name: "financial-data", description: "Currency conversion and current FX data" },
      { name: "agent-utility", description: "Token counting and machine workflow utilities" },
      { name: "web", description: "Page metadata and live web access" },
      { name: "inference", description: "Low-cost model inference" },
      { name: "onchain", description: "EVM and crypto reads" },
      { name: "router", description: "Free discovery and quoting across the full PennyRail portfolio" },
    ],
    paths: {
      "/api/agent/hash": paid(
        "SHA-256 / SHA-512 / MD5 hashing for AI agents",
        "Cheap deterministic cryptographic hash. Compute SHA-256, SHA-512, SHA-1 or MD5 and receive hex plus Base64 digests. Use for checksum, fingerprint, integrity, encoding and agent workflow tasks.",
        "0.001",
        ["hashing", "sha256", "sha512", "checksum", "fingerprint", "encoding"],
        { text: "PennyRail", algorithm: "sha256" },
      ),
      "/api/agent/base64-decode": paid(
        "Base64 decode for AI agents",
        "Decode Base64 text to UTF-8 in one cheap deterministic call. Use for encoded payloads, blobs, tokens and machine workflow data.",
        "0.001",
        ["encoding", "base64", "base64-decode", "decode"],
        { input: "UGVubnlSYWls" },
      ),
      "/api/agent/hex-decode": paid(
        "Hex decode for AI agents",
        "Decode hexadecimal bytes to UTF-8 in one cheap deterministic call. Use for encoded payloads, blockchain data and machine workflow values.",
        "0.001",
        ["encoding", "hex", "hex-decode", "decode", "crypto"],
        { input: "50656e6e795261696c" },
      ),
      "/api/agent/fx-convert": paid(
        "Currency conversion / FX rate for AI agents",
        "Convert an amount between ISO currencies using current FX data. Use for exchange rates, financial data, pricing and international agent workflows.",
        "0.001",
        ["financial-data", "fx", "currency-conversion", "exchange-rate", "market-data"],
        { amount: 100, from: "USD", to: "EUR" },
      ),
      "/api/agent/token-count": paid(
        "Exact LLM token count",
        "Count exact BPE tokens with o200k_base or cl100k_base. Use for context windows, prompt budgeting, model cost estimation and agent planning without a model call.",
        "0.001",
        ["agent-utility", "token-count", "llm", "bpe", "context-window", "prompt-budget"],
        { text: "PennyRail stacks tiny paid calls.", encoding: "o200k_base" },
      ),
      "/api/agent/page-metadata": paid(
        "Page and article metadata extraction",
        "Fetch title, description, canonical URL, favicon, OpenGraph and Twitter Card metadata for a public URL. Use for article metadata, website metadata, link previews and web research.",
        "0.002",
        ["web", "page-metadata", "article-metadata", "open-graph", "url-metadata"],
        { url: "https://example.com" },
      ),
      "/api/agent/chat-mini": paid(
        "Low-cost GPT-4o-mini chat completion",
        "OpenAI-compatible low-cost inference with bounded output, optional tools and structured response format. Use for chat completion, classification, extraction, transformation and short reasoning tasks.",
        "0.02",
        ["inference", "gpt-4o-mini", "chat-completion", "openai", "llm", "ai"],
        { messages: [{ role: "user", content: "Return three tags for machine commerce." }], max_tokens: 128 },
      ),
      "/api/agent/block-number": paid(
        "Latest EVM block number",
        "Return the latest block height for Base, Ethereum, Polygon, Arbitrum or Optimism. Use for crypto data, onchain status, chain monitoring and current EVM block reads.",
        "0.001",
        ["onchain", "evm", "block-number", "crypto-data", "blockchain"],
        { network: "base" },
      ),
      "/api/bazaar/web-search": paid(
        "Live web search with current sources",
        "Search the live web for current information, latest news, current events and fresh research. Returns a grounded answer plus source URLs/titles. Use when model training data is stale.",
        "0.02",
        ["web", "web-search", "live-search", "latest-news", "current-information", "research", "sources"],
        { query: "latest x402 agent commerce news", count: 5, freshness: "pw" },
      ),
      "/api/router/find": {
        get: {
          summary: "Find the best PennyRail capability — FREE",
          description:
            "Free natural-language discovery across PennyRail. Returns ranked capabilities, exact prices, product IDs and paid execution URLs.",
          tags: ["router"],
          security: [],
          parameters: [
            { name: "q", in: "query", required: true, schema: { type: "string" }, example: "search the live web" },
          ],
          responses: { "200": { description: "Ranked capabilities" } },
        },
      },
      "/api/router/quote": {
        get: {
          summary: "Quote a PennyRail capability — FREE",
          description:
            "Free exact quote. Returns product, price, tier, sample input and the exact x402 execute URL. No payment is made.",
          tags: ["router"],
          security: [],
          parameters: [
            { name: "q", in: "query", required: false, schema: { type: "string" } },
            { name: "productId", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: { "200": { description: "Exact quote" } },
        },
      },
    },
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
