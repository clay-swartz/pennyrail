const LEADSMART_COVERAGE_URL = "https://affiliate-bid-coverage.leadsmartinc.com/";

export type LeadYieldOpportunity = {
  zip: string;
  city: string | null;
  state: string | null;
  vertical: string;
  payoutUsd: number;
  updated: string | null;
  callsTo1000Gross: number;
  priority: "A" | "B" | "C";
  source: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanCell(value: string) {
  return decodeHtml(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoney(value: string) {
  const match = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function normalizeNullable(value: string) {
  const cleaned = value.trim();
  return !cleaned || cleaned === "—" || cleaned === "-" ? null : cleaned;
}

function priorityForPayout(payoutUsd: number): "A" | "B" | "C" {
  if (payoutUsd >= 250) return "A";
  if (payoutUsd >= 100) return "B";
  return "C";
}

export function parseLeadSmartCoverage(html: string): LeadYieldOpportunity[] {
  const rows: LeadYieldOpportunity[] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html))) {
    const cells: string[] = [];
    const cellRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowMatch[1]))) {
      cells.push(cleanCell(cellMatch[1]));
    }

    if (cells.length < 5) continue;

    const [zip, cityRaw, stateRaw, vertical, payoutRaw, updatedRaw] = cells;
    if (!/^\d{5}$/.test(zip || "")) continue;

    const payoutUsd = parseMoney(payoutRaw || "");
    if (!payoutUsd || !vertical) continue;

    rows.push({
      zip,
      city: normalizeNullable(cityRaw || ""),
      state: normalizeNullable(stateRaw || ""),
      vertical,
      payoutUsd,
      updated: normalizeNullable(updatedRaw || ""),
      callsTo1000Gross: Math.max(1, Math.ceil(1000 / payoutUsd)),
      priority: priorityForPayout(payoutUsd),
      source: LEADSMART_COVERAGE_URL,
    });
  }

  return rows.sort((a, b) => b.payoutUsd - a.payoutUsd);
}

export async function scanLeadYield() {
  const startedAt = Date.now();

  try {
    const response = await fetch(LEADSMART_COVERAGE_URL, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "PennyRail/1.0 lead-yield-radar",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(18_000),
    });

    const html = await response.text();
    if (!response.ok) {
      throw new Error(`Lead Smart HTTP ${response.status}: ${html.slice(0, 300)}`);
    }

    const rows = parseLeadSmartCoverage(html);
    const uniqueVerticals = [...new Set(rows.map(row => row.vertical))];
    const top = rows.slice(0, 50);

    return {
      ok: true,
      mode: "LEAD_YIELD_RADAR_V53",
      generatedAt: new Date().toISOString(),
      source: {
        name: "Lead Smart public affiliate payout coverage",
        url: LEADSMART_COVERAGE_URL,
        note: "Public targeting guidance; payouts can change during the day.",
      },
      economics: {
        targetNetUsdPerDay: 1000,
        payoutRowsObserved: rows.length,
        verticalsObserved: uniqueVerticals,
        topObservedPayoutUsd: top[0]?.payoutUsd ?? null,
        fewestCallsTo1000Gross: top[0]?.callsTo1000Gross ?? null,
      },
      opportunities: top,
      actionQueue: top.slice(0, 20).map(row => ({
        ...row,
        action:
          row.priority === "A"
            ? "TARGET_FIRST"
            : row.priority === "B"
              ? "RESEARCH_TRAFFIC_COST"
              : "LOW_PRIORITY",
      })),
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "LEAD_YIELD_RADAR_V53",
      generatedAt: new Date().toISOString(),
      source: {
        name: "Lead Smart public affiliate payout coverage",
        url: LEADSMART_COVERAGE_URL,
      },
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    };
  }
}
