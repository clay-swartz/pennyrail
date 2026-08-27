import { NextRequest, NextResponse } from "next/server";
import { paidFetch } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function parseBodyOnce(raw: string) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function normalizeOrigin(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function publicOrigin(req: NextRequest) {
  return (
    normalizeOrigin(process.env.PENNYRAIL_PUBLIC_URL) ??
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeOrigin(req.nextUrl.origin)!
  );
}

function looksLikeVercelProtection(response: Response, raw: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const sample = raw.slice(0, 12000);
  return (
    contentType.includes("text/html") &&
    (/vercel/i.test(sample) || /sso-api/i.test(sample) || /login\?next=/i.test(sample))
  );
}

function isTextStatsResult(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return (
    typeof value.characters === "number" &&
    typeof value.words === "number" &&
    typeof value.sentences === "number" &&
    typeof value.readingSeconds === "number"
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.RADAR_ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.RADAR_ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const origin = publicOrigin(req);
    const url = `${origin}/api/tools/text-stats?text=${encodeURIComponent("PennyRail first paid robot transaction")}`;
    const pf = await paidFetch();
    const response = await pf(url);

    // Fetch response bodies are one-shot streams. Read exactly once.
    const raw = await response.text();
    const body = parseBodyOnce(raw);

    const paymentResponse =
      response.headers.get("payment-response") ??
      response.headers.get("x-payment-response") ??
      response.headers.get("payment-signature") ??
      null;

    const diagnostics = {
      targetOrigin: origin,
      finalUrl: response.url || url,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      paymentResponsePresent: Boolean(paymentResponse),
      usedExplicitPublicUrl: Boolean(process.env.PENNYRAIL_PUBLIC_URL?.trim()),
      usedVercelProductionUrl: !process.env.PENNYRAIL_PUBLIC_URL?.trim() && Boolean(process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()),
    };

    if (looksLikeVercelProtection(response, raw)) {
      return NextResponse.json(
        {
          error: "Vercel Deployment Protection intercepted the self-test",
          diagnostics,
          fix: "The test must call PennyRail's public production domain, not a protected deployment URL. Set PENNYRAIL_PUBLIC_URL to the public Production domain only if VERCEL_PROJECT_PRODUCTION_URL is also protected.",
        },
        { status: 502 },
      );
    }

    if (!response.ok || !isTextStatsResult(body)) {
      return NextResponse.json(
        {
          error: "paid self-test failed",
          diagnostics,
          body,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      paidUsd: 0.001,
      buyer: "CDP-managed PennyRail Radar wallet",
      sellerPayTo: process.env.PENNYRAIL_PAY_TO,
      tool: "/api/tools/text-stats",
      diagnostics,
      result: body,
      message: "PennyRail buyer reached the x402-protected PennyTool and received the expected result.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "unknown error",
        stage: "self-test fetch/payment",
      },
      { status: 500 },
    );
  }
}
