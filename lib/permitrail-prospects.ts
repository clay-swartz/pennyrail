import { buildPermitRailFeed } from "@/lib/permitrail";
import type { PermitRailCity, PermitRailSignal, PermitRailTrade } from "@/lib/permitrail-core";

const TDLR = "https://data.texas.gov/resource/7358-krk7.json";

export type PermitRailProspect = {
  id: string;
  licenseType: string;
  licenseNumber: string;
  businessName: string;
  businessCounty: "DALLAS" | "TARRANT";
  businessCity: string | null;
  businessTelephone: string | null;
  ownerName: string | null;
  expirationDate: string | null;
  trade: PermitRailTrade;
  targetCity: PermitRailCity;
  signalCount: number;
  hotCount: number;
  warmCount: number;
  score: number;
  sampleUrl: string;
  reasons: string[];
};

export type PermitRailProspectScan = {
  checkedAt: string;
  source: string;
  sourceUpdatedAtKnown: string;
  sourceRows: number;
  prospectCount: number;
  prospects: PermitRailProspect[];
  markets: Array<{ city: PermitRailCity; trade: PermitRailTrade; prospects: number; signals: number; hot: number }>;
  errors: string[];
};

type TdlrRow = Record<string, any>;

const LICENSE_TRADE: Array<{ re: RegExp; trade: PermitRailTrade }> = [
  { re: /^Electrical Contractor$/i, trade: "electrical" },
  { re: /^A\/C Contractor$/i, trade: "hvac" },
  { re: /Mold Remediation (?:Company|Contractor)/i, trade: "restoration" },
];

function clean(value: unknown) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return s || null;
}

function normalizeCompany(value: string) {
  return value.toLowerCase().replace(/\b(llc|inc|corp|corporation|company|co|ltd|pllc|lp)\b\.?/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function inferTrade(licenseType: string): PermitRailTrade | null {
  return LICENSE_TRADE.find(row => row.re.test(licenseType))?.trade ?? null;
}

function parseBusinessCity(raw: unknown): string | null {
  const text = clean(raw);
  if (!text) return null;
  const comma = text.split(",")[0]?.trim();
  if (comma && comma.length >= 2) return comma;
  const m = text.match(/^(.+?)\s+TX\s+\d{5}(?:-\d{4})?$/i);
  return m?.[1]?.trim() || text;
}

function isCurrent(expiration: string | null) {
  if (!expiration) return true;
  const t = Date.parse(expiration);
  return !Number.isFinite(t) || t >= Date.now() - 7 * 86_400_000;
}

function cityCandidates(county: string, businessCity: string | null): PermitRailCity[] {
  if (county === "DALLAS") return ["dallas"];
  const c = businessCity?.toLowerCase() || "";
  if (c.includes("arlington")) return ["arlington", "fortworth"];
  if (c.includes("fort worth") || c.includes("ft worth")) return ["fortworth", "arlington"];
  return ["fortworth", "arlington"];
}

function matchSignals(signals: PermitRailSignal[], city: PermitRailCity, trade: PermitRailTrade) {
  return signals.filter(signal => signal.city === city && (signal.primaryTrade === trade || signal.adjacentTrades.includes(trade)));
}

function chooseTarget(signals: PermitRailSignal[], county: string, businessCity: string | null, trade: PermitRailTrade) {
  const ranked = cityCandidates(county, businessCity).map(city => {
    const matching = matchSignals(signals, city, trade);
    const hot = matching.filter(s => s.urgency === "hot").length;
    const warm = matching.filter(s => s.urgency === "warm").length;
    return { city, matching, hot, warm, weight: hot * 8 + warm * 3 + matching.length };
  }).sort((a, b) => b.weight - a.weight);
  return ranked[0];
}

function scoreProspect(args: {
  row: TdlrRow;
  signalCount: number;
  hotCount: number;
  warmCount: number;
  current: boolean;
}) {
  let score = 10;
  const reasons: string[] = [];
  score += Math.min(30, args.signalCount * 2);
  score += Math.min(30, args.hotCount * 8);
  score += Math.min(10, args.warmCount * 2);
  if (clean(args.row.business_telephone) || clean(args.row.owner_telephone)) { score += 8; reasons.push("public business phone present"); }
  if (args.current) { score += 6; reasons.push("license appears current"); }
  if (args.hotCount) reasons.push(`${args.hotCount} current high-priority matching signal${args.hotCount === 1 ? "" : "s"}`);
  if (args.signalCount) reasons.push(`${args.signalCount} matching PermitRail signal${args.signalCount === 1 ? "" : "s"}`);
  return { score: Math.min(100, score), reasons };
}

async function fetchTdlrPage(offset: number, limit: number) {
  const where = [
    "business_name is not null",
    "business_county in ('DALLAS','TARRANT')",
    "license_type in ('Electrical Contractor','A/C Contractor','Mold Remediation Company','Mold Remediation Contractor')",
  ].join(" AND ");
  const params = new URLSearchParams({
    "$select": [
      "license_type", "license_number", "business_county", "business_name",
      "business_address_line1", "business_city_state_zip", "business_telephone",
      "owner_name", "owner_telephone", "license_expiration_date_mmddccyy",
    ].join(","),
    "$where": where,
    "$order": "license_number ASC",
    "$limit": String(limit),
    "$offset": String(offset),
  });
  const response = await fetch(`${TDLR}?${params.toString()}`, {
    headers: { accept: "application/json", "user-agent": "PennyRail-PermitRail/1.0 public-record-acquisition" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`TDLR HTTP ${response.status}: ${raw.slice(0, 180)}`);
  const rows = JSON.parse(raw || "[]");
  return Array.isArray(rows) ? rows as TdlrRow[] : [];
}

export async function scanPermitRailProspects(publicOrigin: string, maxRows = 2000): Promise<PermitRailProspectScan> {
  const errors: string[] = [];
  const rows: TdlrRow[] = [];
  const pageSize = 500;
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    try {
      const page = await fetchTdlrPage(offset, Math.min(pageSize, maxRows - offset));
      rows.push(...page);
      if (page.length < pageSize) break;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      break;
    }
  }

  let signals: PermitRailSignal[] = [];
  try {
    const feed = await buildPermitRailFeed({ minScore: 35, maxAgeHours: 30 * 24, limit: 500 });
    signals = feed.signals;
  } catch (error) {
    errors.push(`PermitRail feed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const dedupe = new Map<string, PermitRailProspect>();
  for (const row of rows) {
    const licenseType = clean(row.license_type);
    const licenseNumber = clean(row.license_number);
    const businessName = clean(row.business_name);
    const county = clean(row.business_county)?.toUpperCase();
    if (!licenseType || !licenseNumber || !businessName || (county !== "DALLAS" && county !== "TARRANT")) continue;
    const trade = inferTrade(licenseType);
    if (!trade) continue;
    const businessCity = parseBusinessCity(row.business_city_state_zip);
    const target = chooseTarget(signals, county, businessCity, trade);
    if (!target) continue;
    const expirationDate = clean(row.license_expiration_date_mmddccyy);
    const scored = scoreProspect({ row, signalCount: target.matching.length, hotCount: target.hot, warmCount: target.warm, current: isCurrent(expirationDate) });
    const id = `${licenseType}:${licenseNumber}`;
    const prospect: PermitRailProspect = {
      id,
      licenseType,
      licenseNumber,
      businessName,
      businessCounty: county,
      businessCity,
      businessTelephone: clean(row.business_telephone) || clean(row.owner_telephone),
      ownerName: clean(row.owner_name),
      expirationDate,
      trade,
      targetCity: target.city,
      signalCount: target.matching.length,
      hotCount: target.hot,
      warmCount: target.warm,
      score: scored.score,
      sampleUrl: `${publicOrigin.replace(/\/$/, "")}/permitrail/market/${target.city}/${trade}`,
      reasons: scored.reasons,
    };
    const key = normalizeCompany(businessName) || id;
    const prior = dedupe.get(key);
    if (!prior || prospect.score > prior.score) dedupe.set(key, prospect);
  }

  const prospects = [...dedupe.values()].sort((a, b) => b.score - a.score || b.hotCount - a.hotCount || b.signalCount - a.signalCount).slice(0, 500);
  const marketMap = new Map<string, { city: PermitRailCity; trade: PermitRailTrade; prospects: number; signals: number; hot: number }>();
  for (const prospect of prospects) {
    const key = `${prospect.targetCity}:${prospect.trade}`;
    const cur = marketMap.get(key) || { city: prospect.targetCity, trade: prospect.trade, prospects: 0, signals: prospect.signalCount, hot: prospect.hotCount };
    cur.prospects += 1;
    cur.signals = Math.max(cur.signals, prospect.signalCount);
    cur.hot = Math.max(cur.hot, prospect.hotCount);
    marketMap.set(key, cur);
  }

  return {
    checkedAt: new Date().toISOString(),
    source: TDLR,
    sourceUpdatedAtKnown: "2026-07-16",
    sourceRows: rows.length,
    prospectCount: prospects.length,
    prospects,
    markets: [...marketMap.values()].sort((a, b) => b.hot - a.hot || b.signals - a.signals || b.prospects - a.prospects).slice(0, 20),
    errors,
  };
}
