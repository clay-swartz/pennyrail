import { createHmac, timingSafeEqual } from "node:crypto";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";
import { resolveRevenueNeed, runRevenueProduct, type RevenueProductDefinition } from "@/lib/revenue-engine";

const API = "https://api.the402.ai";
export const THE402_PROVIDER_NAME = "PennyRail";

export type The402Credentials = {
  participant_id: string;
  api_key: string;
  webhook_secret: string;
  type?: string;
};

export type The402Service = {
  id?: string;
  service_id?: string;
  name?: string;
  [key: string]: any;
};

function asText(v: unknown) { return v == null ? "" : String(v); }

async function parse(response: Response) {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  if (!response.ok) {
    throw new Error(`the402 HTTP ${response.status}: ${typeof body === "string" ? body.slice(0,300) : JSON.stringify(body).slice(0,600)}`);
  }
  return body;
}

export async function registerThe402Provider(webhookUrl: string): Promise<The402Credentials> {
  const payFetch = await paidFetchBaseUsdcCapped(0.01);
  const response = await payFetch(`${API}/v1/register`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      name: THE402_PROVIDER_NAME,
      description: "Autonomous machine-commerce provider: deterministic utilities plus live web search, page intelligence and optional low-cost AI/embedding capabilities fulfilled in seconds.",
      type: "provider",
      webhook_url: webhookUrl,
      capabilities: ["data", "utilities", "developer-tools", "dns", "security", "validation", "automation", "search", "ai", "embeddings", "x402"],
    }),
    cache: "no-store",
  });
  const body = await parse(response);
  const candidate = body?.data && typeof body.data === "object" ? body.data : body;
  const participant_id = asText(candidate?.participant_id).trim();
  const api_key = asText(candidate?.api_key).trim();
  const webhook_secret = asText(candidate?.webhook_secret).trim();
  if (!participant_id || !api_key || !webhook_secret) {
    throw new Error("the402 registration succeeded but did not return participant_id/api_key/webhook_secret");
  }
  return { participant_id, api_key, webhook_secret, type: candidate?.type };
}

function authHeaders(apiKey: string) {
  return { "X-API-Key": apiKey, "content-type": "application/json", accept: "application/json" };
}

const bidInputSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    task: { type: "string", description: "Optional plain-language deterministic task PennyRail should perform." },
    input: { description: "Input for the requested task. May be a string, number, array or JSON object." },
    text: { type: "string", description: "Text input when the task is text-oriented." },
    url: { type: "string", description: "URL input when the task is URL-oriented." },
    domain: { type: "string", description: "Domain input when the task is DNS/domain-oriented." },
    query: { type: "string", description: "Query or lookup value when relevant." },
  },
};

const directInputSchema = {
  ...bidInputSchema,
  required: ["task"],
};

const deliverableSchema = {
  type: "object",
  properties: {
    product: { type: "string" },
    result: { description: "Deterministic PennyRail result." },
  },
};

export const THE402_SERVICE_DEFINITIONS = [
  {
    name: "PennyRail Text Transforms",
    description: "Instant deterministic text cleanup, case conversion, slugging, dedupe, sorting, extraction, counting and truncation for agents.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "developer-tools",
    tags: ["text", "slug", "dedupe", "extract", "transform", "developer-tools"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail JSON Utilities",
    description: "Instant deterministic JSON flattening, key inspection, path lookup, key sorting, pick/omit and canonical utility operations.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "developer-tools",
    tags: ["json", "flatten", "keys", "canonical", "developer-tools", "data"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Encoding Hash Validation",
    description: "Instant base64, hex, URL encoding/decoding, SHA-256 hashing, email validation and UUID validation.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "developer-tools",
    tags: ["encoding", "base64", "hex", "sha256", "hash", "validation"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail URL Utilities",
    description: "Instant URL parsing, normalization, resolution, domain extraction, query-string conversion and tracking cleanup.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "data",
    tags: ["url", "parse", "normalize", "query", "tracking", "domain"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail DNS Record Lookup",
    description: "Instant A, AAAA, MX, TXT, CNAME, NS, CAA and SRV DNS lookups through DNS-over-HTTPS.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "data",
    tags: ["dns", "mx", "txt", "cname", "domain", "network"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Number Time Utilities",
    description: "Instant deterministic numeric stats, sums, percent change, clamp/round plus Unix/ISO conversion and time differences.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "developer-tools",
    tags: ["number", "statistics", "time", "unix", "iso", "math"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Package Repository Lookups",
    description: "Instant NPM latest-version, GitHub repository, package and developer-oriented public data lookups.",
    price: { fixed: "$0.003" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "data",
    tags: ["npm", "github", "package", "repository", "developer", "lookup"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Package Vulnerability Check",
    description: "Instant known-vulnerability lookup for an open-source package version using the OSV database.",
    price: { fixed: "$0.004" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "security",
    tags: ["security", "vulnerability", "osv", "dependency", "package", "cve"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail VIN Decoder",
    description: "Instant VIN decoding to normalized vehicle make, model, year, trim, body and plant metadata using NHTSA vPIC.",
    price: { fixed: "$0.004" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "data",
    tags: ["vehicle", "vin", "decoder", "nhtsa", "automotive", "lookup"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail FX Country Public Data",
    description: "Instant foreign-exchange conversion helpers and country/public registry lookups for machine workflows.",
    price: { fixed: "$0.003" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "finance",
    tags: ["fx", "currency", "country", "public-data", "lookup", "finance"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Batch Utility Router",
    description: "Run up to ten deterministic PennyRail utility operations in one machine job and receive one structured result envelope.",
    price: { fixed: "$0.01" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "automation",
    tags: ["batch", "automation", "utilities", "workflow", "developer-tools"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Web Search",
    description: "Live web search for agents with a grounded answer plus ranked source URLs/titles, bounded to one upstream search-tool call.",
    price: { fixed: "$0.02" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "search",
    tags: ["search", "web", "fresh", "research", "agent", "data"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
    _requires: ["OPENAI_API_KEY"],
  },
  {
    name: "PennyRail Page Intelligence",
    description: "Fetch page metadata or response/security headers from a public URL with SSRF protection.",
    price: { fixed: "$0.003" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "data",
    tags: ["metadata", "headers", "security", "url", "web", "open-graph"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Agent Chat",
    description: "Low-cost bounded GPT-4o-mini chat completions for agent tasks with structured output and optional tool definitions.",
    price: { fixed: "$0.02" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "20s", category: "ai",
    tags: ["ai", "chat", "llm", "openai", "completion", "agent"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
    _requires: ["OPENAI_API_KEY"],
  },
  {
    name: "PennyRail Embeddings",
    description: "Low-cost OpenAI text embeddings for semantic search, RAG, similarity and clustering workflows.",
    price: { fixed: "$0.005" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "20s", category: "ai",
    tags: ["ai", "embeddings", "vector", "rag", "semantic-search"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
    _requires: ["OPENAI_API_KEY"],
  },
  {
    name: "PennyRail Content Moderation",
    description: "Harmful-content classification with category scores using OpenAI omni-moderation.",
    price: { fixed: "$0.002" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "20s", category: "verification",
    tags: ["moderation", "safety", "classification", "ai", "verification"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
    _requires: ["OPENAI_API_KEY"],
  },
  {
    name: "PennyRail Exact Token Count",
    description: "Exact offline o200k_base/cl100k_base token counts for LLM context budgeting.",
    price: { fixed: "$0.001" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "developer-tools",
    tags: ["tokens", "tiktoken", "llm", "context", "developer-tools"], input_schema: directInputSchema, deliverable_schema: deliverableSchema,
  },
  {
    name: "PennyRail Autonomous Utility Router",
    description: "General instant deterministic machine-utility router. Describe a supported task and PennyRail maps it to the live revenue-product portfolio.",
    price: { fixed: "$0.01" }, service_type: "data_api", pricing_model: "fixed", fulfillment_type: "instant", estimated_delivery: "10s", category: "data",
    tags: ["utility", "router", "automation", "data", "x402", "agent"], input_schema: bidInputSchema, deliverable_schema: deliverableSchema,
  },
] as const;

function serviceArray(body: any): The402Service[] {
  const candidates = [body?.services, body?.data?.services, body?.data, body?.results, body?.items];
  const arr = candidates.find(Array.isArray);
  return Array.isArray(arr) ? arr : [];
}

export async function listThe402Services(apiKey?: string) {
  const url = `${API}/v1/services/catalog?q=${encodeURIComponent("PennyRail")}&limit=100`;
  const response = await fetch(url, {
    headers: apiKey ? { "X-API-Key": apiKey, accept: "application/json" } : { accept: "application/json" },
    cache: "no-store",
  });
  return serviceArray(await parse(response));
}

export async function activateThe402Provider(args: { participantId: string; apiKey: string; webhookUrl: string }) {
  const participantId = args.participantId.trim();
  const apiKey = args.apiKey.trim();
  if (!participantId || !apiKey) throw new Error("participantId and apiKey are required");

  // Registration already set webhook_url and returned the webhook_secret. Do
  // not PUT the profile again here: keeping the registered webhook untouched
  // avoids any chance of rotating the secret after the operator stored it.
  const existing = await listThe402Services(apiKey);
  const existingNames = new Set(existing.map(s => asText(s?.name)));
  const created: any[] = [];
  const skippedUnconfigured: Array<{name:string;missingEnv:string[]}> = [];
  for (const definition of THE402_SERVICE_DEFINITIONS) {
    if (existingNames.has(definition.name)) continue;
    const requires = Array.isArray((definition as any)._requires) ? (definition as any)._requires as string[] : [];
    const missingEnv = requires.filter(name => !process.env[name]?.trim());
    if (missingEnv.length) { skippedUnconfigured.push({ name: definition.name, missingEnv }); continue; }
    const { _requires, ...publicDefinition } = definition as any;
    const response = await fetch(`${API}/v1/services`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify(publicDefinition),
      cache: "no-store",
    });
    created.push(await parse(response));
  }

  const notificationResponse = await fetch(`${API}/v1/postings/notifications`, {
    method: "PUT",
    headers: authHeaders(apiKey),
    body: JSON.stringify({ min_budget_usd: 0.01, max_budget_usd: 25 }),
    cache: "no-store",
  });
  const notifications = await parse(notificationResponse);

  const after = await listThe402Services(apiKey);
  return {
    profile: { participantId, webhookUrl: args.webhookUrl, webhookConfiguredAtRegistration: true },
    createdCount: created.length,
    created,
    skippedUnconfigured,
    notifications,
    services: after,
  };
}

export function verifyThe402WebhookSignature(rawBody: string, headers: Headers, apiKey: string, webhookSecret: string) {
  const platformSecret = headers.get("x-platform-secret") || "";
  if (!platformSecret || platformSecret !== apiKey) return false;
  const timestamp = headers.get("x-webhook-timestamp") || "";
  const signature = headers.get("x-webhook-signature") || "";
  if (!timestamp || !signature || !webhookSecret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  const expected = `sha256=${createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function serviceForProduct(product: RevenueProductDefinition | null, services: The402Service[]) {
  const exact = (name: string) => services.find(s => asText(s?.name) === name);
  if (!product) return exact("PennyRail Autonomous Utility Router") || services[0] || null;
  if (product.id === "batch.utility") return exact("PennyRail Batch Utility Router") || services[0] || null;
  if (product.id === "web.search") return exact("PennyRail Web Search") || exact("PennyRail Autonomous Utility Router") || services[0] || null;
  if (/^web\./.test(product.id)) return exact("PennyRail Page Intelligence") || exact("PennyRail Autonomous Utility Router") || services[0] || null;
  if (product.id === "text.token-count") return exact("PennyRail Exact Token Count") || services[0] || null;
  if (/^ai\.embed/.test(product.id)) return exact("PennyRail Embeddings") || exact("PennyRail Autonomous Utility Router") || services[0] || null;
  if (product.id === "ai.moderate") return exact("PennyRail Content Moderation") || exact("PennyRail Autonomous Utility Router") || services[0] || null;
  if (/^ai\./.test(product.id)) return exact("PennyRail Agent Chat") || exact("PennyRail Autonomous Utility Router") || services[0] || null;
  if (/^text\./.test(product.id)) return exact("PennyRail Text Transforms") || services[0] || null;
  if (/^json\./.test(product.id)) return exact("PennyRail JSON Utilities") || services[0] || null;
  if (/^(encoding|validation|crypto)\./.test(product.id)) return exact("PennyRail Encoding Hash Validation") || services[0] || null;
  if (/^url\./.test(product.id)) return exact("PennyRail URL Utilities") || services[0] || null;
  if (/^dns\./.test(product.id)) return exact("PennyRail DNS Record Lookup") || services[0] || null;
  if (/^(number|time)\./.test(product.id)) return exact("PennyRail Number Time Utilities") || services[0] || null;
  if (/^(npm|github)\./.test(product.id)) return exact("PennyRail Package Repository Lookups") || services[0] || null;
  if (/^security\./.test(product.id)) return exact("PennyRail Package Vulnerability Check") || services[0] || null;
  if (/^vehicle\./.test(product.id)) return exact("PennyRail VIN Decoder") || services[0] || null;
  if (/^(fx|country)\./.test(product.id)) return exact("PennyRail FX Country Public Data") || services[0] || null;
  return exact("PennyRail Autonomous Utility Router") || services[0] || null;
}

function serviceId(service: The402Service | null) {
  return asText(service?.id || service?.service_id).trim();
}

export async function getThe402Posting(postingId: string, apiKey: string) {
  const response = await fetch(`${API}/v1/postings/${encodeURIComponent(postingId)}`, {
    headers: { "X-API-Key": apiKey, accept: "application/json" },
    cache: "no-store",
  });
  return parse(response);
}

function requestText(payload: any, details: any) {
  const brief = details?.brief || details?.data?.brief || details?.posting?.brief || details?.data?.posting?.brief || {};
  const title = asText(details?.title || details?.data?.title || details?.posting?.title || details?.data?.posting?.title || payload?.title);
  const category = asText(details?.category || details?.data?.category || details?.posting?.category || details?.data?.posting?.category || payload?.category);
  return `${title} ${category} ${JSON.stringify(brief).slice(0, 1800)}`.trim();
}

export async function maybeBidThe402Request(payload: any, apiKey: string) {
  const postingId = asText(payload?.posting_id).trim();
  if (!postingId) return { bid: false, reason: "missing posting_id" };
  let details: any = null;
  try { details = await getThe402Posting(postingId, apiKey); } catch {}
  const text = requestText(payload, details);
  const resolved = resolveRevenueNeed(text);
  if (!resolved || resolved.score < 5) return { bid: false, reason: "no strong PennyRail capability match", task: text.slice(0, 300) };

  const maxBudget = Number(payload?.budget_max_usd ?? details?.budget_max_usd ?? details?.data?.budget_max_usd ?? details?.posting?.budget_max_usd ?? details?.data?.posting?.budget_max_usd ?? 0);
  const minBudget = Number(payload?.budget_min_usd ?? details?.budget_min_usd ?? details?.data?.budget_min_usd ?? details?.posting?.budget_min_usd ?? details?.data?.posting?.budget_min_usd ?? 0);
  if (!Number.isFinite(maxBudget) || maxBudget <= 0 || maxBudget > 25) {
    return { bid: false, reason: "budget outside unverified provider ceiling", maxBudget };
  }

  const services = await listThe402Services(apiKey);
  // Open-request briefs are authored by the poster, not by PennyRail, so they
  // cannot be required to match one of our direct-purchase task schemas. Use
  // the permissive router service for bids; fulfillment still executes the
  // specifically matched PennyRail product.
  const selected = services.find(s => asText(s?.name) === "PennyRail Autonomous Utility Router") || serviceForProduct(resolved.product, services);
  const selectedId = serviceId(selected);
  if (!selectedId) return { bid: false, reason: "PennyRail the402 service not found" };

  const marketBid = Math.min(5, Math.max(0.05, maxBudget * 0.20));
  const price = Math.min(maxBudget, Math.max(minBudget || 0, marketBid));
  if (!Number.isFinite(price) || price <= 0) return { bid: false, reason: "invalid bid price" };

  const response = await fetch(`${API}/v1/postings/${encodeURIComponent(postingId)}/bids`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      price_usd: Number(price.toFixed(4)),
      eta_hours: 0.1,
      service_id: selectedId,
      pitch: `Automated PennyRail fulfillment matched to ${resolved.product.title}. Deterministic machine result; typical delivery is seconds.`,
    }),
    cache: "no-store",
  });
  const body = await parse(response);
  return { bid: true, postingId, priceUsd: Number(price.toFixed(4)), serviceId: selectedId, product: resolved.product.id, matchScore: resolved.score, response: body };
}

function inferJobTask(payload: any) {
  const brief = payload?.brief || {};
  const task = asText(brief?.task || brief?.need || brief?.query || brief?.operation || brief?.request).trim();
  if (task) return task;
  return `${asText(payload?.service_name)} ${JSON.stringify(brief).slice(0, 1800)}`.trim();
}

function inferJobInput(brief: any) {
  if (brief && Object.prototype.hasOwnProperty.call(brief, "input")) return brief.input;
  const preferred = ["text", "url", "domain", "name", "value", "data", "vin", "package", "query"];
  for (const key of preferred) if (brief && Object.prototype.hasOwnProperty.call(brief, key)) return brief[key];
  return brief;
}

export async function fulfillThe402Job(payload: any, apiKey: string) {
  const callbackUrl = asText(payload?.callback_url).trim();
  if (!callbackUrl.startsWith(`${API}/v1/`)) throw new Error("unexpected the402 callback URL");
  const task = inferJobTask(payload);
  const resolved = resolveRevenueNeed(task);
  if (!resolved || resolved.score < 3) {
    await fetch(callbackUrl, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ status: "failed", notes: "PennyRail could not map this brief to a supported deterministic capability." }),
      cache: "no-store",
    });
    return { fulfilled: false, reason: "no capability match", task };
  }
  const input = inferJobInput(payload?.brief || {});
  try {
    const result = await runRevenueProduct(`${resolved.product.id}--the402`, resolved.product.tier, input);
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        status: "completed",
        deliverables: { product: resolved.product.id, result: result.result },
        notes: `PennyRail ${resolved.product.title} completed automatically.`,
      }),
      cache: "no-store",
    });
    const callback = await parse(response);
    return { fulfilled: true, product: resolved.product.id, matchScore: resolved.score, callback };
  } catch (error) {
    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify({ status: "failed", notes: error instanceof Error ? error.message : "PennyRail execution failed" }),
        cache: "no-store",
      });
    } catch {}
    return { fulfilled: false, product: resolved.product.id, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sweepThe402Requests(apiKey: string, limit = 20) {
  const response = await fetch(`${API}/v1/postings?limit=${Math.max(1, Math.min(50, Math.trunc(limit)))}`, {
    headers: { "X-API-Key": apiKey, accept: "application/json" },
    cache: "no-store",
  });
  const body = await parse(response);
  const candidates = [body?.postings, body?.data?.postings, body?.data, body?.items, body?.results];
  const postings = candidates.find(Array.isArray) || [];
  const results: any[] = [];
  for (const posting of postings.slice(0, limit)) {
    const postingId = asText(posting?.id || posting?.posting_id).trim();
    if (!postingId) continue;
    try {
      results.push(await maybeBidThe402Request({ ...posting, posting_id: postingId }, apiKey));
    } catch (error) {
      results.push({ bid: false, postingId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { checked: postings.length, bidsPlaced: results.filter(r => r?.bid).length, results };
}

export async function the402Earnings(apiKey: string) {
  const response = await fetch(`${API}/v1/provider/earnings`, {
    headers: { "X-API-Key": apiKey, accept: "application/json" },
    cache: "no-store",
  });
  return parse(response);
}
