import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function rowsFromWishes(payload: any): AnyRow[] {
  const candidates = [
    payload?.clusters,
    payload?.wishes,
    payload?.data?.clusters,
    payload?.data?.wishes,
    payload?.aggregate?.clusters,
  ];
  return candidates.find(Array.isArray) || [];
}

function sourcesOf(row: AnyRow) {
  const s = row?.sources || {};
  return {
    api: Number(s.api || 0),
    mcp: Number(s.mcp || 0),
    findMiss: Number(s["find-miss"] || s.findMiss || 0),
  };
}

function signalType(row: AnyRow) {
  const s = sourcesOf(row);
  const total = s.api + s.mcp + s.findMiss;
  if (!total) return "mixed";
  const explicit = s.api + s.mcp;
  if (s.findMiss / total >= 2 / 3) return "discoverability";
  if (explicit / total >= 2 / 3) return "explicit-request";
  return "mixed";
}

function looksNoisy(text: string) {
  const t = text.trim().toLowerCase();
  return t === "test" || t.includes("probe-test") || t.includes("launch check") || t === "ping" || t === "heartbeat";
}

function extractFindResults(payload: any): AnyRow[] {
  const candidates = [payload?.results, payload?.matches, payload?.tools, payload?.data?.results, payload?.data?.matches];
  return candidates.find(Array.isArray) || [];
}

function ageDays(value: any) {
  const ms = Date.parse(String(value || ""));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (Date.now() - ms) / 86_400_000);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const wishesRes = await fetch("https://agent402.tools/api/wishes", { cache: "no-store" });
    if (!wishesRes.ok) {
      return NextResponse.json({
        error: "Agent402 wishes feed unavailable",
        status: wishesRes.status,
      }, { status: 502 });
    }

    const wishes = await wishesRes.json();
    const rows = rowsFromWishes(wishes)
      .filter((r: AnyRow) => r && typeof (r.text ?? r.query ?? r.wish) === "string")
      .map((r: AnyRow) => ({ ...r, text: String(r.text ?? r.query ?? r.wish).trim() }))
      .filter((r: AnyRow) => r.text)
      .sort((a: AnyRow, b: AnyRow) => Number(b.count || 1) - Number(a.count || 1))
      .slice(0, 12);

    const threshold = Number(wishes?.threshold ?? wishes?.buildThreshold ?? wishes?.data?.threshold ?? 5) || 5;

    const supplyChecks = await Promise.all(rows.slice(0, 10).map(async (row: AnyRow) => {
      const url = `https://agent402.tools/api/find?q=${encodeURIComponent(row.text)}`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        const body = res.ok ? await res.json() : null;
        const matches = extractFindResults(body);
        const first = matches[0] || body?.best || body?.result || null;
        return {
          text: row.text,
          ok: res.ok,
          count: matches.length || (first ? 1 : 0),
          best: first ? {
            name: first.name || first.slug || first.title || first.tool || null,
            price: first.price || first.priceUsd || null,
            route: first.route || first.path || first.url || null,
            score: first.score ?? first.matchScore ?? null,
          } : null,
        };
      } catch {
        return { text: row.text, ok: false, count: 0, best: null };
      }
    }));

    const supplyMap = new Map(supplyChecks.map(x => [x.text, x]));

    const opportunities = rows.map((row: AnyRow) => {
      const count = Number(row.count || 1);
      const type = signalType(row);
      const noise = Boolean(row.noise) || looksNoisy(row.text);
      const gap = Math.max(0, threshold - count);
      const nearThreshold = gap <= 2;
      const age = ageDays(row.lastSeen || row.last_seen || row.updatedAt);
      const supply = supplyMap.get(row.text) || { ok: false, count: 0, best: null };

      let score = count * 10;
      score += type === "explicit-request" ? 15 : type === "mixed" ? 7 : -8;
      if (nearThreshold) score += 10;
      if (age !== null) score += age <= 3 ? 8 : age <= 7 ? 5 : age <= 30 ? 2 : -3;
      if (supply.ok) score += supply.count === 0 ? 15 : supply.count === 1 ? 5 : supply.count >= 4 ? -10 : -4;
      if (noise) score -= 100;

      const action = !noise && type !== "discoverability" && score >= 45 && supply.count <= 1
        ? "BUILD"
        : !noise && score >= 25
          ? "WATCH"
          : "IGNORE";

      const reasons = [
        `${count} demand signal${count === 1 ? "" : "s"}`,
        type === "explicit-request" ? "agents explicitly asked for it" : type === "discoverability" ? "may be a discovery problem, not a missing tool" : "mixed demand signal",
        nearThreshold ? `within ${gap} of Agent402's build threshold` : `${gap} signals below build threshold`,
        supply.ok ? (supply.count === 0 ? "no matching supply found" : `${supply.count} matching result${supply.count === 1 ? "" : "s"} found`) : "supply check unavailable",
      ];

      return {
        action,
        score,
        text: row.text,
        count,
        signalType: type,
        nearThreshold,
        gapToThreshold: gap,
        lastSeen: row.lastSeen || row.last_seen || null,
        ageDays: age === null ? null : Number(age.toFixed(1)),
        sources: sourcesOf(row),
        noise,
        supply,
        reasons,
      };
    }).sort((a: AnyRow, b: AnyRow) => b.score - a.score);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: "Agent402 free wishes + free find/supply checks",
      buildThreshold: threshold,
      rawSignalsSeen: rows.length,
      buildNow: opportunities.filter((x: AnyRow) => x.action === "BUILD").length,
      watch: opportunities.filter((x: AnyRow) => x.action === "WATCH").length,
      opportunities,
      note: "This is PennyRail's free first-pass radar. Paid Demand Radar + Bestsellers can be layered in after the buyer wallet holds Base mainnet USDC.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}
