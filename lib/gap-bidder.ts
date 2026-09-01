import {
  fulfillThe402Job,
  getThe402Posting,
  listThe402Services,
  maybeBidThe402Request,
} from "@/lib/the402";
import { runOpenAiAgentExecution } from "@/lib/revenue-upstreams";

const API = "https://api.the402.ai";
const GAP_SERVICE_NAME = "PennyRail Agent Gap Executor";
const GAP_PRICE_USD = 0.75;

function text(value: unknown) { return value == null ? "" : String(value); }

async function parse(response: Response) {
  const raw = await response.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw || null; }
  if (!response.ok) {
    throw new Error(`the402 HTTP ${response.status}: ${typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 600)}`);
  }
  return body;
}

function authHeaders(apiKey: string) {
  return { "X-API-Key": apiKey, "content-type": "application/json", accept: "application/json" };
}

function serviceId(service: any) {
  return text(service?.id || service?.service_id).trim();
}

function postingEnvelope(details: any) {
  return details?.data?.posting || details?.posting || details?.data || details || {};
}

function postingText(payload: any, details: any) {
  const row = postingEnvelope(details);
  const brief = row?.brief || payload?.brief || {};
  return [
    text(row?.title || payload?.title),
    text(row?.category || payload?.category),
    JSON.stringify(brief).slice(0, 6000),
  ].filter(Boolean).join("\n").trim();
}

function budget(details: any, payload: any) {
  const row = postingEnvelope(details);
  const values = [
    row?.budget_max_usd,
    row?.budget_usd,
    payload?.budget_max_usd,
    payload?.budget_usd,
  ];
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function minBudget(details: any, payload: any) {
  const row = postingEnvelope(details);
  const values = [row?.budget_min_usd, payload?.budget_min_usd];
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function gapEligible(task: string) {
  const value = task.toLowerCase();
  if (task.length < 12 || task.length > 9_000) return { ok: false, reason: "task length outside autonomous gap bounds" };

  const disallowed = [
    /password|seed phrase|private key|credential|login to|account access/,
    /phish|ransomware|malware|steal|fraud|bypass security|exploit a vulnerability|ddos/,
    /weapon|firearm|explosive|bomb|poison/,
    /diagnos|medical advice|prescription|legal advice|act as my lawyer/,
    /place (a )?trade|execute (a )?trade|investment advice|gambling|place (a )?bet/,
    /transfer funds|wire money|send money|purchase on my behalf|buy on my behalf/,
    /call (a|the) person|phone call|meet in person|onsite|physical delivery|ship (a|the)/,
  ];
  if (disallowed.some(pattern => pattern.test(value))) {
    return { ok: false, reason: "request requires disallowed, high-risk, credentialed, financial, or physical-world action" };
  }
  return { ok: true, reason: "bounded digital task" };
}

function requestedTools(task: string) {
  const value = task.toLowerCase();
  if (/latest|current|today|recent|search|research|find|verify|source|citation|website|web\b|url\b/.test(value)) {
    return ["web_search"];
  }
  if (/code|python|javascript|typescript|csv|dataset|analy[sz]e data|calculate|debug/.test(value)) {
    return ["code_exec"];
  }
  return [];
}

async function ensureGapService(apiKey: string) {
  const existing = await listThe402Services(apiKey);
  const found = existing.find(service => text(service?.name) === GAP_SERVICE_NAME);
  if (found) return found;
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is required for gap execution");

  const response = await fetch(`${API}/v1/services`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      name: GAP_SERVICE_NAME,
      description: "Autonomous bounded AI execution for digital tasks that do not map to an existing marketplace tool: research, synthesis, structured analysis, code/data work and machine-ready answers. Designed specifically to fill unmet agent demand gaps in seconds.",
      price: { fixed: `$${GAP_PRICE_USD.toFixed(2)}` },
      service_type: "automated_service",
      pricing_model: "fixed",
      fulfillment_type: "automated",
      estimated_delivery: "2m",
      category: "automation",
      tags: ["agent", "automation", "research", "analysis", "code", "data", "gap", "unmet-demand"],
      input_schema: {
        type: "object",
        additionalProperties: true,
        required: ["task"],
        properties: {
          task: { type: "string", minLength: 1, maxLength: 6000 },
          context: { type: "string", maxLength: 8000 },
        },
      },
      deliverable_schema: {
        type: "object",
        properties: {
          result: { type: "string" },
          reasoning_summary: { type: "string" },
          confidence: { type: "number" },
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const created = await parse(response);
  return created?.data || created;
}

export async function maybeBidThe402RequestWithGapFallback(payload: any, apiKey: string) {
  const exact = await maybeBidThe402Request(payload, apiKey);
  if (exact?.bid) return { ...exact, mode: "EXISTING_CAPABILITY" };

  const postingId = text(payload?.posting_id || payload?.id).trim();
  if (!postingId) return { bid: false, mode: "GAP", reason: "missing posting_id" };

  let details: any = null;
  try { details = await getThe402Posting(postingId, apiKey); } catch {}
  const task = postingText(payload, details);
  const eligible = gapEligible(task);
  if (!eligible.ok) return { bid: false, mode: "GAP", postingId, reason: eligible.reason, task: task.slice(0, 500) };
  if (!process.env.OPENAI_API_KEY?.trim()) return { bid: false, mode: "GAP", postingId, reason: "OPENAI_API_KEY not configured" };

  const maxBudget = budget(details, payload);
  const floor = minBudget(details, payload);
  if (maxBudget < GAP_PRICE_USD || maxBudget > 25) {
    return { bid: false, mode: "GAP", postingId, reason: "budget outside autonomous gap executor range", maxBudget };
  }

  const service = await ensureGapService(apiKey);
  const selectedId = serviceId(service);
  if (!selectedId) return { bid: false, mode: "GAP", postingId, reason: "gap executor service id missing" };

  const marketBid = Math.min(5, Math.max(GAP_PRICE_USD, maxBudget * 0.25));
  const priceUsd = Math.min(maxBudget, Math.max(floor, marketBid));

  const response = await fetch(`${API}/v1/postings/${encodeURIComponent(postingId)}/bids`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      price_usd: Number(priceUsd.toFixed(4)),
      eta_hours: 0.05,
      service_id: selectedId,
      pitch: "PennyRail detected this as an unmet digital-agent gap and can execute it autonomously now. Bounded AI/web/code execution; machine-readable delivery in minutes.",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await parse(response);
  return {
    bid: true,
    mode: "UNMET_DEMAND_GAP",
    postingId,
    priceUsd: Number(priceUsd.toFixed(4)),
    serviceId: selectedId,
    task: task.slice(0, 500),
    response: body,
  };
}

function jobTask(payload: any) {
  const brief = payload?.brief || {};
  const explicit = text(brief?.task || brief?.need || brief?.request || brief?.query || brief?.prompt).trim();
  if (explicit) return explicit;
  return [text(payload?.service_name), JSON.stringify(brief).slice(0, 7000)].filter(Boolean).join("\n").trim();
}

function isGapJob(payload: any) {
  return text(payload?.service_name).trim() === GAP_SERVICE_NAME;
}

export async function fulfillThe402JobWithGapFallback(payload: any, apiKey: string) {
  if (!isGapJob(payload)) return fulfillThe402Job(payload, apiKey);

  const callbackUrl = text(payload?.callback_url).trim();
  if (!callbackUrl.startsWith(`${API}/v1/`)) throw new Error("unexpected the402 callback URL");
  const task = jobTask(payload);
  const eligible = gapEligible(task);
  if (!eligible.ok) {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({ status: "failed", notes: eligible.reason }),
      cache: "no-store",
    });
    await parse(response);
    return { fulfilled: false, mode: "GAP", reason: eligible.reason };
  }

  try {
    const result = await runOpenAiAgentExecution({
      task,
      context: `Fulfill this paid marketplace request directly and concisely. Preserve the buyer's constraints. Brief: ${JSON.stringify(payload?.brief || {}).slice(0, 7000)}`,
      max_steps: 3,
      tools: requestedTools(task),
    });
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        status: "completed",
        deliverables: {
          product: "agent-gap-execution",
          result: result?.output?.result ?? result,
          reasoning_summary: result?.output?.reasoning ?? null,
          confidence: result?.output?.confidence ?? null,
        },
        notes: "PennyRail fulfilled an unmet agent-demand gap autonomously.",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const callback = await parse(response);
    return { fulfilled: true, mode: "UNMET_DEMAND_GAP", usage: result?.usage ?? null, callback };
  } catch (error) {
    try {
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: authHeaders(apiKey),
        body: JSON.stringify({ status: "failed", notes: error instanceof Error ? error.message : "gap execution failed" }),
        cache: "no-store",
      });
      await parse(response);
    } catch {}
    return { fulfilled: false, mode: "GAP", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sweepThe402RequestsWithGapFallback(apiKey: string, limit = 25) {
  const response = await fetch(`${API}/v1/postings?limit=${Math.max(1, Math.min(50, Math.trunc(limit)))}`, {
    headers: { "X-API-Key": apiKey, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = await parse(response);
  const candidates = [body?.postings, body?.data?.postings, body?.data, body?.items, body?.results];
  const postings: any[] = candidates.find(Array.isArray) || [];
  const results: any[] = [];
  for (const posting of postings.slice(0, limit)) {
    const postingId = text(posting?.id || posting?.posting_id).trim();
    if (!postingId) continue;
    try {
      results.push(await maybeBidThe402RequestWithGapFallback({ ...posting, posting_id: postingId }, apiKey));
    } catch (error) {
      results.push({ bid: false, postingId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return {
    checked: postings.length,
    bidsPlaced: results.filter(row => row?.bid).length,
    existingCapabilityBids: results.filter(row => row?.bid && row?.mode === "EXISTING_CAPABILITY").length,
    gapBids: results.filter(row => row?.bid && row?.mode === "UNMET_DEMAND_GAP").length,
    unresolvedObserved: results.filter(row => !row?.bid && row?.mode === "GAP").length,
    results,
  };
}
