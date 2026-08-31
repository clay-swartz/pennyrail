import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetch } from "@/lib/radar-buyer";
import { FACTORY_CAPABILITIES, matchCapability } from "@/lib/factory";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function authorized(req: NextRequest) { return isRadarAdmin(req); }

function objectKeys(value: any) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).slice(0, 30) : [];
}

function findEnvelope(root: any) {
  const seen = new Set<any>();
  const queue: Array<{ value: any; path: string; depth: number }> = [{ value: root, path: "$", depth: 0 }];
  let fallback: { value: any; path: string } | null = null;

  while (queue.length && seen.size < 250) {
    const node = queue.shift()!;
    const value = node.value;
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    if (Array.isArray(value.radar)) return { envelope: value, rows: value.radar, rowSource: "radar", path: node.path };
    if (Array.isArray(value.clusters) && value.clusters.some((r: any) => r && typeof r === "object" && (r.text || r.need || r.query))) {
      fallback ||= { value, path: node.path };
    }

    if (node.depth >= 5) continue;
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") queue.push({ value: child, path: `${node.path}.${key}`, depth: node.depth + 1 });
    }
  }

  if (fallback) return { envelope: fallback.value, rows: fallback.value.clusters, rowSource: "clusters", path: fallback.path };
  return { envelope: root, rows: [] as AnyRow[], rowSource: "none", path: "$" };
}

function normalizeRow(row: AnyRow) {
  const sources = row?.sources || {};
  const api = Number(sources.api || 0);
  const mcp = Number(sources.mcp || 0);
  const findMiss = Number(sources["find-miss"] || sources.findMiss || 0);
  const total = api + mcp + findMiss;
  const inferredType = !total
    ? "mixed"
    : findMiss / total >= 2 / 3
      ? "discoverability"
      : (api + mcp) / total >= 2 / 3
        ? "explicit-request"
        : "mixed";

  const count = Number(row.count || row.demandSignals || 0);
  const threshold = Number(row.buildThreshold || row.threshold || 5);
  const gap = Number.isFinite(Number(row.gapToThreshold))
    ? Number(row.gapToThreshold)
    : Math.max(0, threshold - count);

  return {
    text: String(row.text || row.need || row.query || "").trim(),
    count,
    signalType: row.signalType || inferredType,
    nearThreshold: typeof row.nearThreshold === "boolean" ? row.nearThreshold : gap <= 2,
    gapToThreshold: gap,
    noise: Boolean(row.noise),
  };
}

const TRANSIENT_UPSTREAM = new Set([502, 503, 504]);

async function buyDemandRadarWithRetry(pf: typeof fetch) {
  const url = "https://agent402.tools/api/demand-radar?sort=count&limit=30&minCount=1";
  const attempts: Array<{ attempt: number; status: number; statusText: string }> = [];

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await pf(url);
    attempts.push({
      attempt,
      status: response.status,
      statusText: response.statusText,
    });

    if (response.ok || !TRANSIENT_UPSTREAM.has(response.status) || attempt === 3) {
      return { response, attempts };
    }

    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
  }

  throw new Error("Demand Radar retry loop exited unexpectedly.");
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const pf = await paidFetch();
    const purchase = await buyDemandRadarWithRetry(pf);
    const demandRes = purchase.response;
    const rawText = await demandRes.text();
    let rawDemand: any = null;
    try { rawDemand = rawText ? JSON.parse(rawText) : null; } catch {}

    if (!demandRes.ok) {
      return NextResponse.json({
        error: "Demand Radar purchase failed",
        status: demandRes.status,
        statusText: demandRes.statusText,
        contentType: demandRes.headers.get("content-type") || null,
        demand: rawDemand,
        preview: rawDemand ? null : rawText.slice(0, 1000),
        retries: purchase.attempts,
        upstream: "Agent402 Demand Radar",
      }, { status: 502 });
    }

    const found = findEnvelope(rawDemand);
    const radar = found.rows.map(normalizeRow).filter((r: any) => r.text && !r.noise);

    const ranked = radar
      .map((r: any) => {
        const match = matchCapability(r.text);
        const explicit = r.signalType === "explicit-request";
        const score = r.count * 10 + (explicit ? 20 : r.signalType === "mixed" ? 8 : -12) + (r.nearThreshold ? 12 : 0) + (match ? Math.min(20, match.score) : 0);
        return {
          need: r.text,
          demandSignals: r.count,
          signalType: r.signalType,
          nearThreshold: r.nearThreshold,
          gapToThreshold: r.gapToThreshold,
          score,
          status: match ? "AUTO-LIVE" : "NEEDS-BUILDER",
          operation: match?.capability.id || null,
          capability: match?.capability.title || null,
          inputHint: match?.capability.inputHint || null,
          priceUsd: match ? 0.003 : null,
        };
      })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 8);

    const envelope = found.envelope || {};
    return NextResponse.json({
      ok: true,
      status: ranked.length ? "OPPORTUNITIES_FOUND" : "NO_OPPORTUNITIES_RETURNED",
      generatedAt: new Date().toISOString(),
      intelSpendUsd: 0.005,
      demandSummary: {
        totalWishes: envelope?.totalWishes ?? rawDemand?.totalWishes ?? null,
        distinctClusters: envelope?.distinctClusters ?? rawDemand?.distinctClusters ?? null,
        matchedClusters: envelope?.matchedClusters ?? rawDemand?.matchedClusters ?? null,
        buildThreshold: envelope?.buildThreshold ?? envelope?.threshold ?? rawDemand?.buildThreshold ?? null,
        extractedRows: radar.length,
      },
      factory: {
        liveCapabilities: FACTORY_CAPABILITIES.length,
        paidRunPriceUsd: 0.003,
        autoLive: ranked.filter((x: any) => x.status === "AUTO-LIVE").length,
        needsBuilder: ranked.filter((x: any) => x.status === "NEEDS-BUILDER").length,
      },
      opportunities: ranked,
      diagnostics: {
        httpStatus: demandRes.status,
        contentType: demandRes.headers.get("content-type") || null,
        topLevelKeys: objectKeys(rawDemand),
        envelopePath: found.path,
        envelopeKeys: objectKeys(found.envelope),
        rowSource: found.rowSource,
        rawBodyBytes: rawText.length,
        rawPreview: JSON.stringify(rawDemand)?.slice(0, 1600) || rawText.slice(0, 1600),
        purchaseAttempts: purchase.attempts,
      },
      note: ranked.length
        ? "Factory scan completed from paid demand intelligence."
        : "The paid call succeeded but no usable demand rows were extracted. Diagnostics show the exact envelope PennyRail received.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "factory scan failed",
      hint: "PennyRail reached an unexpected factory error after payment setup.",
    }, { status: 500 });
  }
}
