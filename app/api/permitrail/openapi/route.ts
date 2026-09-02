import { NextRequest, NextResponse } from "next/server";
import { PERMITRAIL_TRADES } from "@/lib/permitrail-core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function origin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "PermitRail DFW Project Intelligence API",
      version: "1.0.0",
      description: "Fresh public-record construction/project signals normalized and scored for contractor opportunity, trade fit, recency, value and urgency.",
    },
    servers: [{ url: origin(req) }],
    paths: {
      "/api/permitrail/rapid/feed": {
        get: {
          summary: "Get scored DFW project signals",
          parameters: [
            { name: "city", in: "query", schema: { type: "string", enum: ["all", "fortworth", "arlington", "dallas"], default: "all" } },
            { name: "trade", in: "query", schema: { type: "string", enum: ["all", ...PERMITRAIL_TRADES], default: "all" } },
            { name: "minScore", in: "query", schema: { type: "number", minimum: 0, maximum: 100, default: 45 } },
            { name: "maxAgeHours", in: "query", schema: { type: "integer", minimum: 1, maximum: 2160, default: 720 } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } },
          ],
          responses: {
            "200": { description: "Scored PermitRail signals; response also emits X-RapidAPI-Billing: Signals=N for usage-based quota accounting.", content: { "application/json": { schema: { type: "object" } } } },
            "401": { description: "Invalid RapidAPI proxy secret" },
          },
        },
      },
    },
  };
  return NextResponse.json(spec, { headers: { "cache-control": "public, max-age=300" } });
}
