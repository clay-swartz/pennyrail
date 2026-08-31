import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";
import { FACTORY_CAPABILITIES, runFactoryOperation } from "@/lib/factory";

const known = new Set(FACTORY_CAPABILITIES.map(c => c.id));

function defaultProbeInput(operation: string): any {
  switch (operation) {
    case "text.lines-dedupe":
    case "text.lines-sort":
    case "text.remove-empty-lines":
      return "alpha\nbeta\nalpha";

    case "text.truncate":
      return { text: "PennyRail", max: 5 };

    case "json.flatten":
    case "json.keys":
    case "json.sort-keys":
      return { hello: "world" };

    case "json.get":
      return { value: { hello: "world" }, path: "hello" };

    case "json.pick":
    case "json.omit":
      return { value: { a: 1, b: 2 }, keys: ["a"] };

    case "url.parse":
    case "url.normalize":
    case "url.domain":
      return "https://example.com/path?utm_source=x402-list&a=1";

    case "url.resolve":
      return { base: "https://example.com/a/", relative: "../b" };

    case "url.query-to-json":
      return "a=1&b=two";

    case "url.json-to-query":
      return { a: 1, b: "two" };

    case "number.stats":
    case "number.sum":
      return [1, 2, 3];

    case "number.percent-change":
      return { from: 100, to: 125 };

    case "number.clamp":
      return { value: 15, min: 0, max: 10 };

    case "number.round":
      return { value: 3.14159, decimals: 2 };

    case "time.to-iso":
      return 1700000000;

    case "time.to-unix":
      return "2026-01-01T00:00:00Z";

    case "time.diff-seconds":
      return {
        from: "2026-01-01T00:00:00Z",
        to: "2026-01-01T00:01:00Z",
      };

    case "encoding.base64-decode":
      return "UGVubnlSYWls";

    case "encoding.hex-decode":
      return "50656e6e795261696c";

    case "encoding.url-decode":
      return "hello%20world";

    case "dns.a":
      return "example.com";

    case "npm.latest":
      return "react";

    case "github.repo":
      return "x402-foundation/x402";

    case "fx.convert":
      return { amount: 1, from: "USD", to: "EUR" };

    case "country.lookup":
      return "US";

    case "validation.email":
      return "hello@example.com";

    case "validation.uuid":
      return "550e8400-e29b-41d4-a716-446655440000";

    default:
      return "PennyRail";
  }
}

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const prefix = "/api/f/";
    const pathname = req.nextUrl.pathname;
    const operation = decodeURIComponent(
      pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ""
    ).trim();

    if (!operation || !known.has(operation)) {
      return NextResponse.json({ error: "unknown operation", operation }, { status: 404 });
    }

    let body: any;
    let inputDefaulted = false;
    try {
      body = await req.json();
    } catch {
      body = { input: defaultProbeInput(operation) };
      inputDefaulted = true;
    }

    const result = await runFactoryOperation(operation, body?.input ?? body);
    return NextResponse.json({ operation, result, inputDefaulted });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "operation failed" },
      { status: 400 },
    );
  }
};

export const POST = withX402(
  handler,
  penny("Run one PennyRail machine utility.", "$0.001"),
  x402Server,
);
