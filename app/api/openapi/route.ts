import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = (process.env.PENNYRAIL_PUBLIC_URL?.trim() || req.nextUrl.origin).replace(/\/$/, "");
  const price = "$0.001";

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "PennyRail PennyTools",
      version: "0.2.0",
      description: "Deterministic x402 pay-per-call utilities for autonomous agents.",
    },
    servers: [{ url: origin }],
    paths: {
      "/api/tools/json-canonicalize": {
        post: {
          operationId: "jsonCanonicalize",
          summary: "Canonicalize JSON deterministically",
          description: "Recursively sort JSON object keys and return a canonical JSON string plus byte count.",
          tags: ["utility", "json"],
          "x-price": price,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
          responses: {
            "200": { description: "Canonical JSON result" },
            "402": { description: "x402 payment required" },
          },
        },
      },
      "/api/tools/text-stats": {
        get: {
          operationId: "textStats",
          summary: "Count text characters, words, sentences and reading time",
          description: "Return deterministic text statistics for a supplied string.",
          tags: ["utility", "text"],
          "x-price": price,
          parameters: [{ name: "text", in: "query", required: true, schema: { type: "string" } }],
          responses: {
            "200": { description: "Text statistics" },
            "402": { description: "x402 payment required" },
          },
        },
      },
      "/api/tools/strip-tracking": {
        get: {
          operationId: "stripTrackingParameters",
          summary: "Remove common tracking parameters from a URL",
          description: "Strip common marketing and click-tracking query parameters while preserving the functional URL.",
          tags: ["utility", "url"],
          "x-price": price,
          parameters: [{ name: "url", in: "query", required: true, schema: { type: "string", format: "uri" } }],
          responses: {
            "200": { description: "Cleaned URL and removed parameters" },
            "402": { description: "x402 payment required" },
          },
        },
      },
    },
  }, {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
