export type PermitRailCity = "fortworth" | "arlington" | "dallas";
export type PermitRailSourceKind = "building-permit" | "row-permit" | "311-signal";
export type PermitRailTrade =
  | "general-contractor"
  | "roofing"
  | "hvac"
  | "electrical"
  | "plumbing"
  | "solar"
  | "pool"
  | "fencing"
  | "landscaping"
  | "concrete"
  | "flooring"
  | "cabinets"
  | "painting"
  | "windows"
  | "gutters"
  | "excavation"
  | "utility"
  | "restoration";

export type RawProjectSignal = {
  sourceKind: PermitRailSourceKind;
  sourceName: string;
  sourceUrl: string;
  city: PermitRailCity;
  permitId: string;
  permitType: string | null;
  description: string | null;
  status: string | null;
  createdAt: string | null;
  issuedAt: string | null;
  address: string | null;
  zipCode: string | null;
  ownerName: string | null;
  contractorName: string | null;
  declaredValueUsd: number | null;
  sqft: number | null;
  raw?: Record<string, unknown>;
};

export type PermitRailSignal = RawProjectSignal & {
  id: string;
  observedAt: string;
  primaryTrade: PermitRailTrade;
  adjacentTrades: PermitRailTrade[];
  score: number;
  urgency: "hot" | "warm" | "watch";
  intent: "direct" | "adjacent" | "infrastructure" | "distress";
  estimatedOpportunityValueUsd: number | null;
  valueBasis: "declared" | "heuristic" | "unknown";
  ageHours: number | null;
  reasons: string[];
};

const TRADE_RULES: Array<{
  trade: PermitRailTrade;
  re: RegExp;
  adjacent: PermitRailTrade[];
  heuristicValue: number;
}> = [
  { trade: "roofing", re: /roof|reroof|re-roof|shingle|membrane/i, adjacent: ["gutters", "solar", "restoration"], heuristicValue: 15000 },
  { trade: "hvac", re: /hvac|mechanical|air\s*condition|furnace|heat pump|duct/i, adjacent: ["electrical", "plumbing"], heuristicValue: 12000 },
  { trade: "electrical", re: /electrical|electric|service upgrade|panel|meter|generator/i, adjacent: ["solar", "hvac"], heuristicValue: 9000 },
  { trade: "plumbing", re: /plumb|sewer|water line|water service|repipe|gas line|gas service/i, adjacent: ["excavation", "restoration"], heuristicValue: 8500 },
  { trade: "solar", re: /solar|photovoltaic|pv system/i, adjacent: ["electrical", "roofing"], heuristicValue: 22000 },
  { trade: "pool", re: /pool|spa|swimming/i, adjacent: ["fencing", "landscaping", "electrical", "concrete"], heuristicValue: 65000 },
  { trade: "fencing", re: /fence|fencing|gate/i, adjacent: ["landscaping", "concrete"], heuristicValue: 9000 },
  { trade: "concrete", re: /concrete|driveway|sidewalk|paving|flatwork|curb/i, adjacent: ["landscaping", "excavation"], heuristicValue: 14000 },
  { trade: "windows", re: /window|glazing|fenestration/i, adjacent: ["painting", "restoration"], heuristicValue: 18000 },
  { trade: "gutters", re: /gutter|downspout/i, adjacent: ["roofing", "restoration"], heuristicValue: 7000 },
  { trade: "landscaping", re: /landscap|irrigation|tree|grading|retaining wall/i, adjacent: ["fencing", "concrete"], heuristicValue: 12000 },
  { trade: "excavation", re: /excavat|trench|boring|bore|underground/i, adjacent: ["utility", "plumbing", "concrete"], heuristicValue: 25000 },
  { trade: "utility", re: /utility|fiber|telecom|gas main|water main|power line/i, adjacent: ["excavation", "concrete"], heuristicValue: 50000 },
  { trade: "flooring", re: /floor|tile|carpet/i, adjacent: ["painting", "cabinets"], heuristicValue: 10000 },
  { trade: "cabinets", re: /cabinet|millwork|casework/i, adjacent: ["flooring", "painting"], heuristicValue: 16000 },
  { trade: "painting", re: /paint|coating/i, adjacent: ["restoration"], heuristicValue: 8000 },
  { trade: "restoration", re: /fire damage|water damage|storm damage|unsafe|emergency repair|damage/i, adjacent: ["roofing", "plumbing", "electrical", "painting"], heuristicValue: 20000 },
  { trade: "general-contractor", re: /new construction|new building|addition|remodel|renovation|tenant finish|alteration|build out|buildout|residential building|commercial building/i, adjacent: ["hvac", "electrical", "plumbing", "roofing", "flooring", "cabinets", "painting", "fencing", "landscaping"], heuristicValue: 100000 },
];

function finite(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  return s ? s : null;
}

export function toIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" || /^\d{12,}$/.test(String(value))) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      const d = new Date(n);
      return Number.isFinite(d.getTime()) ? d.toISOString() : null;
    }
  }
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function money(value: unknown): number | null {
  const n = finite(String(value ?? "").replace(/[$,]/g, ""));
  return n == null || n === 0 ? null : n;
}

function hashPart(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function classify(raw: RawProjectSignal) {
  const haystack = [raw.permitType, raw.description, raw.status].filter(Boolean).join(" | ");
  const match = TRADE_RULES.find(rule => rule.re.test(haystack));
  if (match) return match;
  if (raw.sourceKind === "row-permit") {
    return { trade: "excavation" as PermitRailTrade, adjacent: ["utility", "concrete"] as PermitRailTrade[], heuristicValue: 25000 };
  }
  if (raw.sourceKind === "311-signal") {
    return { trade: "restoration" as PermitRailTrade, adjacent: ["general-contractor"] as PermitRailTrade[], heuristicValue: 10000 };
  }
  return { trade: "general-contractor" as PermitRailTrade, adjacent: ["electrical", "plumbing", "hvac"] as PermitRailTrade[], heuristicValue: 50000 };
}

function hoursSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (nowMs - t) / 3_600_000);
}

function recencyPoints(ageHours: number | null) {
  if (ageHours == null) return 5;
  if (ageHours <= 24) return 40;
  if (ageHours <= 72) return 34;
  if (ageHours <= 7 * 24) return 28;
  if (ageHours <= 14 * 24) return 20;
  if (ageHours <= 30 * 24) return 10;
  return 0;
}

function valuePoints(value: number | null) {
  if (value == null) return 7;
  if (value >= 250_000) return 25;
  if (value >= 100_000) return 21;
  if (value >= 50_000) return 18;
  if (value >= 25_000) return 15;
  if (value >= 10_000) return 11;
  return 7;
}

function statusPoints(status: string | null) {
  const s = status?.toLowerCase() || "";
  if (/issued|open|active|approved|in warranty|in progress/.test(s)) return 15;
  if (/pending|review|submitted|received/.test(s)) return 10;
  if (/final|closed|complete|expired|cancel/.test(s)) return 2;
  return 7;
}

function sourcePoints(kind: PermitRailSourceKind) {
  if (kind === "building-permit") return 10;
  if (kind === "row-permit") return 8;
  return 4;
}

export function enrichSignal(raw: RawProjectSignal, now = new Date()): PermitRailSignal {
  const classification = classify(raw);
  const date = raw.issuedAt || raw.createdAt;
  const ageHours = hoursSince(date, now.getTime());
  const declared = raw.declaredValueUsd;
  const estimated = declared ?? classification.heuristicValue ?? null;
  const score = Math.min(100,
    recencyPoints(ageHours) +
    valuePoints(declared ?? estimated) +
    statusPoints(raw.status) +
    sourcePoints(raw.sourceKind) +
    Math.min(10, classification.adjacent.length * 2),
  );
  const reasons: string[] = [];
  if (ageHours != null && ageHours <= 72) reasons.push("fresh filing");
  if ((declared ?? 0) >= 50_000) reasons.push("high declared project value");
  if (classification.adjacent.length >= 3) reasons.push("multiple downstream trades can act");
  if (/issued|open|active|approved|in warranty|in progress/i.test(raw.status || "")) reasons.push("actionable stage");
  if (raw.contractorName) reasons.push("contractor identity present in public record");
  const intent: PermitRailSignal["intent"] = raw.sourceKind === "311-signal"
    ? "distress"
    : raw.sourceKind === "row-permit"
      ? "infrastructure"
      : classification.trade === "general-contractor" && classification.adjacent.length >= 3
        ? "adjacent"
        : "direct";
  return {
    ...raw,
    id: `${raw.city}:${hashPart(`${raw.sourceKind}|${raw.permitId}|${raw.address || ""}`)}`,
    observedAt: now.toISOString(),
    primaryTrade: classification.trade,
    adjacentTrades: [...new Set(classification.adjacent.filter(t => t !== classification.trade))],
    score,
    urgency: score >= 78 ? "hot" : score >= 58 ? "warm" : "watch",
    intent,
    estimatedOpportunityValueUsd: estimated,
    valueBasis: declared != null ? "declared" : estimated != null ? "heuristic" : "unknown",
    ageHours: ageHours == null ? null : Number(ageHours.toFixed(1)),
    reasons,
  };
}

export function normalizeSignals(raw: RawProjectSignal[], now = new Date()) {
  const deduped = new Map<string, PermitRailSignal>();
  for (const row of raw) {
    const enriched = enrichSignal(row, now);
    const key = `${row.city}|${row.permitId || ""}|${row.address || ""}`.toLowerCase();
    const existing = deduped.get(key);
    if (!existing || enriched.score > existing.score) deduped.set(key, enriched);
  }
  return [...deduped.values()].sort((a, b) => b.score - a.score || (Date.parse(b.issuedAt || b.createdAt || "") || 0) - (Date.parse(a.issuedAt || a.createdAt || "") || 0));
}

export const PERMITRAIL_TRADES: PermitRailTrade[] = [
  "general-contractor", "roofing", "hvac", "electrical", "plumbing", "solar", "pool", "fencing", "landscaping", "concrete", "flooring", "cabinets", "painting", "windows", "gutters", "excavation", "utility", "restoration",
];

export const PERMITRAIL_CITIES: PermitRailCity[] = ["fortworth", "arlington", "dallas"];

export function maskAddress(address: string | null) {
  if (!address) return null;
  return address.replace(/^\s*\d+[A-Z-]*\s+/i, "*** ");
}
