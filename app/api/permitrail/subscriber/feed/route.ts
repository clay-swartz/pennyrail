import { NextRequest, NextResponse } from "next/server";
import { buildPermitRailFeed } from "@/lib/permitrail";
import { verifyPermitRailSubscriber } from "@/lib/permitrail-stripe";
import type { PermitRailCity, PermitRailTrade } from "@/lib/permitrail-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function csvEscape(value: unknown) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(signals: any[]) {
  const fields = ["id", "city", "permitId", "primaryTrade", "adjacentTrades", "score", "urgency", "ageHours", "estimatedOpportunityValueUsd", "valueBasis", "permitType", "description", "status", "address", "zipCode", "ownerName", "contractorName", "declaredValueUsd", "issuedAt", "createdAt", "sourceKind", "sourceName", "sourceUrl"];
  return [fields.join(","), ...signals.map(row => fields.map(field => csvEscape(field === "adjacentTrades" ? row[field]?.join("|") : row[field])).join(","))].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id") || "";
    const token = req.nextUrl.searchParams.get("token") || "";
    const subscriber = await verifyPermitRailSubscriber(sessionId, token);
    const requestedCity = (req.nextUrl.searchParams.get("city") || subscriber.city || "all") as PermitRailCity | "all";
    const requestedTrade = (req.nextUrl.searchParams.get("trade") || subscriber.trade || "all") as PermitRailTrade | "all";
    const city = subscriber.plan.cityScope === "single" ? subscriber.city as PermitRailCity : requestedCity;
    const trade = subscriber.plan.tradeScope === "single" ? subscriber.trade as PermitRailTrade : requestedTrade;
    const feed = await buildPermitRailFeed({
      city,
      trade,
      minScore: Number(req.nextUrl.searchParams.get("minScore") || 45),
      maxAgeHours: Number(req.nextUrl.searchParams.get("maxAgeHours") || 720),
      limit: Math.min(subscriber.plan.maxSignalsPerRequest, Number(req.nextUrl.searchParams.get("limit") || subscriber.plan.maxSignalsPerRequest)),
    });
    if ((req.nextUrl.searchParams.get("format") || "json").toLowerCase() === "csv") {
      return new NextResponse(toCsv(feed.signals), { status: 200, headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store", "content-disposition": `attachment; filename="permitrail-${new Date().toISOString().slice(0, 10)}.csv"` } });
    }
    return NextResponse.json({ ...feed, subscriberPlan: subscriber.plan.id }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 401 });
  }
}
