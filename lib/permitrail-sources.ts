import { cleanText, money, toIso, type RawProjectSignal } from "@/lib/permitrail-core";

const FORT_WORTH = "https://services5.arcgis.com/3ddLCBXe1bRt7mzj/arcgis/rest/services/CFW_Open_Data_Development_Permits_View/FeatureServer/0";
const ARLINGTON = "https://gis2.arlingtontx.gov/agsext2/rest/services/OpenData/OD_Property/MapServer/1";
const DALLAS_ROW = "https://gis.dallascityhall.com/arcgis/rest/services/Pbw_public/ROWMSPermits/MapServer/0";
const DALLAS_311 = "https://www.dallasopendata.com/resource/d7e7-envw.json";

export type PermitRailSourceHealth = {
  source: string;
  city: string;
  ok: boolean;
  rows: number;
  newestAt: string | null;
  elapsedMs: number;
  error: string | null;
};

export type PermitRailSourceScan = {
  rows: RawProjectSignal[];
  health: PermitRailSourceHealth[];
};

async function fetchJson(url: string, timeoutMs = 14_000) {
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "PennyRail-PermitRail/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const raw = await r.text();
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch {}
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${raw.slice(0, 240)}`);
  if (body?.error) throw new Error(String(body?.error?.message || JSON.stringify(body.error).slice(0, 240)));
  return body;
}

async function queryArcGis(base: string, opts: {
  where?: string;
  outFields: string[];
  orderByFields: string;
  limit: number;
}) {
  const url = new URL(`${base}/query`);
  url.searchParams.set("where", opts.where || "1=1");
  url.searchParams.set("outFields", opts.outFields.join(","));
  url.searchParams.set("orderByFields", opts.orderByFields);
  url.searchParams.set("resultRecordCount", String(opts.limit));
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  const body = await fetchJson(url.toString());
  return Array.isArray(body?.features) ? body.features.map((f: any) => f?.attributes || {}) : [];
}

function newest(rows: RawProjectSignal[]) {
  let best: string | null = null;
  for (const row of rows) {
    const d = row.issuedAt || row.createdAt;
    if (d && (!best || Date.parse(d) > Date.parse(best))) best = d;
  }
  return best;
}

function fwAddress(a: any) {
  const full = cleanText(a?.Full_Street_Address);
  if (full) return full;
  const pieces = [a?.Addr_No, a?.Direction, a?.Street_Name, a?.Street_Suffix, a?.Street_Suffix_Dir]
    .map(cleanText).filter(Boolean);
  const line = pieces.join(" ");
  return cleanText([line, a?.Zip_Code].filter(Boolean).join(", "));
}

async function fortWorth(limit: number): Promise<RawProjectSignal[]> {
  const rows = await queryArcGis(FORT_WORTH, {
    outFields: [
      "Permit_No", "Permit_Type", "Permit_SubType", "Permit_Category", "B1_SPECIAL_TEXT", "B1_WORK_DESC",
      "Addr_No", "Direction", "Street_Name", "Street_Suffix", "Street_Suffix_Dir", "Full_Street_Address", "Zip_Code",
      "Owner_Full_Name", "File_Date", "Current_Status", "Status_Date", "JobValue", "Use_Type", "Specific_Use", "Units", "SqFt",
    ],
    orderByFields: "File_Date DESC",
    limit,
  });
  return rows.map((a: any) => {
    const work = cleanText(a?.B1_WORK_DESC);
    const description = work && work.toUpperCase() !== "B1_WORK_DESC" ? work : cleanText(a?.B1_SPECIAL_TEXT || a?.Specific_Use || a?.Use_Type);
    return {
      sourceKind: "building-permit",
      sourceName: "City of Fort Worth Open Data — Development Permits",
      sourceUrl: FORT_WORTH,
      city: "fortworth",
      permitId: cleanText(a?.Permit_No) || `fw-${cleanText(a?.File_Date) || "unknown"}-${cleanText(a?.Street_Name) || "unknown"}`,
      permitType: cleanText([a?.Permit_Type, a?.Permit_SubType, a?.Permit_Category].filter(Boolean).join(" | ")),
      description,
      status: cleanText(a?.Current_Status),
      createdAt: toIso(a?.File_Date),
      issuedAt: toIso(a?.Status_Date),
      address: fwAddress(a),
      zipCode: cleanText(a?.Zip_Code),
      ownerName: cleanText(a?.Owner_Full_Name),
      contractorName: null,
      declaredValueUsd: money(a?.JobValue),
      sqft: money(a?.SqFt),
    } satisfies RawProjectSignal;
  });
}

function arlingtonPermitId(a: any) {
  const prefix = [cleanText(a?.FOLDERTYPE), cleanText(a?.FOLDERYEAR)].filter(Boolean).join("");
  const seq = cleanText(a?.FOLDERSEQUENCE);
  return seq ? `${prefix}-${seq}` : prefix || `arlington-${cleanText(a?.OBJECTID) || "unknown"}`;
}

async function arlington(limit: number): Promise<RawProjectSignal[]> {
  const rows = await queryArcGis(ARLINGTON, {
    outFields: [
      "OBJECTID", "FOLDERTYPE", "FOLDERYEAR", "FOLDERSEQUENCE", "STATUSDESC", "ISSUEDATE", "FINALDATE",
      "SUBDESC", "WORKDESC", "FOLDERNAME", "ConstructionValuationDeclared", "MainUse",
    ],
    orderByFields: "ISSUEDATE DESC",
    limit,
  });
  return rows.map((a: any) => ({
    sourceKind: "building-permit",
    sourceName: "City of Arlington Open Data — Issued Permits",
    sourceUrl: ARLINGTON,
    city: "arlington",
    permitId: arlingtonPermitId(a),
    permitType: cleanText([a?.FOLDERTYPE, a?.SUBDESC, a?.MainUse].filter(Boolean).join(" | ")),
    description: cleanText(a?.WORKDESC),
    status: cleanText(a?.STATUSDESC),
    createdAt: toIso(a?.ISSUEDATE),
    issuedAt: toIso(a?.ISSUEDATE),
    address: cleanText(a?.FOLDERNAME),
    zipCode: null,
    ownerName: null,
    contractorName: null,
    declaredValueUsd: money(a?.ConstructionValuationDeclared),
    sqft: null,
  } satisfies RawProjectSignal));
}

async function dallasRow(limit: number): Promise<RawProjectSignal[]> {
  const rows = await queryArcGis(DALLAS_ROW, {
    outFields: [
      "OBJECTID", "EXTERNALFILENUM", "PERMITTYPE", "COMMERCIALORRESIDENTIAL", "STATUSDESCRIPTION", "CREATEDDATE", "ISSUEDATE",
      "ROWREQUESTEDSTARTDATE", "ROWESTIMATEDCOMPLETIONDATE", "ROWREASONFORJOB", "ROWIMPROVEMENTREPAIR", "ROWISEMERGENCYREPAIR",
      "SPECIFICLOCATION", "WORKDESCRIPTION", "APPLICANTNAMESTORED", "APPLICANTCOMPANYNAMESTORED", "ALLCONTRACTORSNAME", "LOCATIONNAMES",
    ],
    orderByFields: "CREATEDDATE DESC",
    limit,
  });
  return rows.map((a: any) => ({
    sourceKind: "row-permit",
    sourceName: "City of Dallas Public Works — ROW Permits",
    sourceUrl: DALLAS_ROW,
    city: "dallas",
    permitId: cleanText(a?.EXTERNALFILENUM) || `dallas-row-${cleanText(a?.OBJECTID) || "unknown"}`,
    permitType: cleanText([a?.PERMITTYPE, a?.ROWIMPROVEMENTREPAIR, a?.COMMERCIALORRESIDENTIAL].filter(Boolean).join(" | ")),
    description: cleanText([a?.WORKDESCRIPTION, a?.ROWREASONFORJOB, a?.SPECIFICLOCATION].filter(Boolean).join(" | ")),
    status: cleanText(a?.STATUSDESCRIPTION),
    createdAt: toIso(a?.CREATEDDATE),
    issuedAt: toIso(a?.ISSUEDATE),
    address: cleanText(a?.LOCATIONNAMES || a?.SPECIFICLOCATION),
    zipCode: null,
    ownerName: cleanText(a?.APPLICANTNAMESTORED || a?.APPLICANTCOMPANYNAMESTORED),
    contractorName: cleanText(a?.ALLCONTRACTORSNAME),
    declaredValueUsd: null,
    sqft: null,
  } satisfies RawProjectSignal));
}

const DISTRESS_RE = /(water leak|sewer|flood|storm|tree down|tree emergency|electrical|street cut|sidewalk|structural|unsafe|damage|gas leak|water main|sanitary sewer)/i;

async function dallas311(limit: number): Promise<RawProjectSignal[]> {
  const url = new URL(DALLAS_311);
  url.searchParams.set("$limit", String(Math.min(300, limit * 2)));
  url.searchParams.set("$order", "created_date DESC");
  const rows = await fetchJson(url.toString(), 12_000);
  if (!Array.isArray(rows)) return [];
  const cutoff = Date.now() - 30 * 86_400_000;
  return rows
    .filter((a: any) => DISTRESS_RE.test(String(a?.service_request_type || "")) && (Date.parse(String(a?.created_date || "")) || 0) >= cutoff)
    .slice(0, Math.min(limit, 100))
    .map((a: any) => ({
      sourceKind: "311-signal",
      sourceName: "City of Dallas Open Data — 311 Service Requests",
      sourceUrl: DALLAS_311,
      city: "dallas",
      permitId: cleanText(a?.service_request_number) || `dallas-311-${cleanText(a?.unique_key) || "unknown"}`,
      permitType: cleanText(a?.service_request_type),
      description: cleanText(a?.outcome),
      status: cleanText(a?.status),
      createdAt: toIso(a?.created_date),
      issuedAt: null,
      // 311 is used as area-level distress context, not a homeowner-contact product.
      // Strip the street number even though the source record is public.
      address: cleanText(a?.address)?.replace(/^\s*\d+[A-Z-]*\s+/i, "*** ") || null,
      zipCode: null,
      ownerName: null,
      contractorName: null,
      declaredValueUsd: null,
      sqft: null,
    } satisfies RawProjectSignal));
}

async function measured(name: string, city: string, fn: () => Promise<RawProjectSignal[]>) {
  const started = Date.now();
  try {
    const rows = await fn();
    return {
      rows,
      health: { source: name, city, ok: true, rows: rows.length, newestAt: newest(rows), elapsedMs: Date.now() - started, error: null } satisfies PermitRailSourceHealth,
    };
  } catch (error) {
    return {
      rows: [] as RawProjectSignal[],
      health: { source: name, city, ok: false, rows: 0, newestAt: null, elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) } satisfies PermitRailSourceHealth,
    };
  }
}

export async function scanPermitRailSources(perSourceLimit = 250): Promise<PermitRailSourceScan> {
  const [fw, arl, dalRow, dal311] = await Promise.all([
    measured("fort-worth-development-permits", "fortworth", () => fortWorth(perSourceLimit)),
    measured("arlington-issued-permits", "arlington", () => arlington(perSourceLimit)),
    measured("dallas-row-permits", "dallas", () => dallasRow(perSourceLimit)),
    measured("dallas-311-distress-signals", "dallas", () => dallas311(Math.min(100, perSourceLimit))),
  ]);
  return {
    rows: [...fw.rows, ...arl.rows, ...dalRow.rows, ...dal311.rows],
    health: [fw.health, arl.health, dalRow.health, dal311.health],
  };
}
