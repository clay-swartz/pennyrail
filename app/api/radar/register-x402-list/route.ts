import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";
import { buyerAccount } from "@/lib/radar-buyer";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

export const dynamic = "force-dynamic";

const SUBMIT_URL = "https://x402-list.com/api/v1/submit";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const APPROVED_MAX_ATOMIC = 1_000_000n; // $1.00 USDC, 6 decimals.

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return req.nextUrl.origin.replace(/\/$/, "");
}

function endpointInventory() {
  // x402 List's initial /submit API accepts path strings only (no HTTP method
  // prefix). It probes the path and detects the payment requirements itself.
  return [
    "/api/tools/json-canonicalize",
    "/api/tools/text-stats",
    "/api/tools/strip-tracking",
    ...FACTORY_CAPABILITIES.map(c => `/api/f/${c.id}`),
  ];
}

async function parseResponse(response: Response) {
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text || null; }
  return { body, text };
}

function requirementAmount(requirement: any) {
  const raw = requirement?.amount ?? requirement?.maxAmountRequired ?? "0";
  try { return BigInt(String(raw)); } catch { return 0n; }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let requestBody: any = null;
  try { requestBody = await req.json(); } catch {}
  const email = typeof requestBody?.email === "string" ? requestBody.email.trim() : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "A valid review-contact email is required." }, { status: 400 });
  }

  const origin = publicOrigin(req);
  const endpoints = endpointInventory();
  if (endpoints.length !== 50) {
    return NextResponse.json({
      error: "PennyRail endpoint inventory is not exactly 50 paid resources.",
      endpointCount: endpoints.length,
    }, { status: 500 });
  }

  // Match x402 List's documented initial-submission path grammar locally so a
  // malformed endpoint can never trigger a paid submission attempt.
  const invalidEndpoints = endpoints.filter(path => !/^\/[A-Za-z0-9/_.~-]+$/.test(path));
  if (invalidEndpoints.length) {
    return NextResponse.json({
      error: "PennyRail generated an invalid x402 List endpoint path. Nothing was paid.",
      invalidEndpoints,
    }, { status: 500 });
  }

  const payload = {
    url: origin,
    email,
    service_name: "PennyRail",
    description: "Tiny deterministic pay-per-call utilities for autonomous agents: text, JSON, URL, encoding, validation, numeric, time, and public-data operations settled with x402 USDC on Base.",
    website_url: origin,
    category: "Compute",
    endpoints,
    notes: "PennyRail exposes 50 individually priced paid utility endpoints at $0.001 each. x402scan successfully registered the complete public discovery surface before this submission. The free catalog and generic factory dispatcher are intentionally omitted from this 50-endpoint review payload.",
  };

  const requestInit: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  };

  try {
    // First probe without a payment signature. This prevents the wallet from
    // spending unless x402 List returns a challenge that matches the exact
    // Base-USDC fee the operator already approved (up to $1.00).
    const preview = await fetch(SUBMIT_URL, requestInit);
    const previewParsed = await parseResponse(preview);

    if (preview.status === 201) {
      return NextResponse.json({
        ok: true,
        paidUsd: 0,
        endpointCount: endpoints.length,
        stage: "submitted-without-fee",
        response: previewParsed.body,
      });
    }

    if (preview.status !== 402) {
      return NextResponse.json({
        error: "x402 List did not return the expected submission/payment response.",
        stage: "preflight",
        status: preview.status,
        response: previewParsed.body,
      }, { status: 502 });
    }

    const accepts = Array.isArray(previewParsed.body?.accepts) ? previewParsed.body.accepts : [];
    const accepted = accepts[0];
    const amount = requirementAmount(accepted);
    const network = String(accepted?.network || "");
    const asset = String(accepted?.asset || "").toLowerCase();
    const scheme = String(accepted?.scheme || "");

    if (!accepted || scheme !== "exact" || network !== "eip155:8453" || asset !== BASE_USDC || amount <= 0n) {
      return NextResponse.json({
        error: "x402 List returned an unexpected payment requirement. Nothing was paid.",
        stage: "payment-safety-check",
        requirement: accepted || null,
        response: previewParsed.body,
      }, { status: 502 });
    }

    if (amount > APPROVED_MAX_ATOMIC) {
      return NextResponse.json({
        error: "Payment exceeds the approved $1.00 ceiling. Nothing was paid.",
        stage: "payment-safety-check",
        requestedUsd: Number(amount) / 1_000_000,
        approvedMaxUsd: 1,
        response: previewParsed.body,
      }, { status: 409 });
    }

    // Build a dedicated payment client for this submission. The selector is a
    // wallet-level ceiling: even if the server challenge changes after the
    // preflight, PennyRail will not sign a payment above the approved $1.00.
    const account = await buyerAccount();
    const client = new x402Client((_version, requirements) => {
      const safe = requirements.find((r: any) => {
        const requested = requirementAmount(r);
        return String(r?.scheme || "") === "exact" &&
          String(r?.network || "") === "eip155:8453" &&
          String(r?.asset || "").toLowerCase() === BASE_USDC &&
          requested > 0n && requested <= APPROVED_MAX_ATOMIC;
      });
      if (!safe) throw new Error("No x402 payment option fits PennyRail's approved $1.00 Base-USDC ceiling.");
      return safe;
    });
    client.register("eip155:*", new ExactEvmScheme(account as any));
    const pf = wrapFetchWithPayment(globalThis.fetch, client);
    const paid = await pf(SUBMIT_URL, requestInit);
    const paidParsed = await parseResponse(paid);

    if (paid.status !== 201) {
      let buyerAddress: string | null = null;
      try { buyerAddress = String((await buyerAccount()).address); } catch {}
      return NextResponse.json({
        error: "x402 List payment/submission did not complete.",
        stage: "paid-submit",
        status: paid.status,
        attemptedUsd: Number(amount) / 1_000_000,
        buyerAddress,
        response: paidParsed.body,
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      stage: "submitted",
      paidUsd: Number(amount) / 1_000_000,
      endpointCount: endpoints.length,
      reviewContactStoredByX402List: true,
      response: paidParsed.body,
      paymentResponsePresent: Boolean(
        paid.headers.get("payment-response") || paid.headers.get("x-payment-response")
      ),
      note: "PennyRail entered the x402 List human review queue. x402 List will notify the supplied email of the outcome.",
    });
  } catch (error) {
    let buyerAddress: string | null = null;
    try { buyerAddress = String((await buyerAccount()).address); } catch {}
    return NextResponse.json({
      error: error instanceof Error ? error.message : "x402 List submission failed",
      stage: "submission",
      buyerAddress,
      hint: "If the error is insufficient funds, send at least $1.00 USDC on Base to the Radar buyer address and retry once.",
    }, { status: 500 });
  }
}
