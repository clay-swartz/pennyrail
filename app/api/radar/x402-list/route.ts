import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

const X402_LIST = "https://x402-list.com";

function authorized(req: NextRequest) {
  return isRadarAdmin(req);
}

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  return (explicit || req.nextUrl.origin).replace(/\/$/, "");
}

async function readJson(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; }
  catch { return { raw: text.slice(0, 1000) }; }
}

async function findPennyRail(origin: string) {
  const url = new URL("/api/v1/services", X402_LIST);
  url.searchParams.set("q", "PennyRail");
  url.searchParams.set("per_page", "25");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const body = await readJson(response);

  if (!response.ok) {
    throw new Error(`x402 List search HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  const rows = Array.isArray(body?.data) ? body.data : [];
  const normalize = (value: unknown) => String(value || "").replace(/\/$/, "").toLowerCase();
  const listing =
    rows.find((row: any) => normalize(row?.base_url) === normalize(origin)) ||
    rows.find((row: any) => String(row?.name || "").toLowerCase() === "pennyrail") ||
    null;

  return { listing, searchCount: rows.length };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const origin = publicOrigin(req);
    const found = await findPennyRail(origin);
    return NextResponse.json({
      ok: true,
      source: "x402-list.com",
      origin,
      ...found,
      note: found.listing
        ? "PennyRail listing found. Verified means x402 List paid a real endpoint and delivery succeeded."
        : "PennyRail was not found in the current x402 List search response.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "x402 List status failed" },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const origin = publicOrigin(req);
    const before = await findPennyRail(origin);
    const listing = before.listing;

    if (!listing?.slug) {
      return NextResponse.json(
        { error: "PennyRail listing not found on x402 List", origin, searchCount: before.searchCount },
        { status: 404 },
      );
    }

    if (listing.verified) {
      return NextResponse.json({
        ok: true,
        alreadyVerified: true,
        paidUsdMax: 0,
        listing,
        note: "PennyRail is already x402 List Verified.",
      });
    }

    if (!listing.payment_ready) {
      return NextResponse.json(
        {
          error: "PennyRail is listed but is not currently payment-ready on x402 List. Do not pay for verification until its free probe is healthy.",
          listing,
        },
        { status: 409 },
      );
    }

    // x402 List currently charges $0.25 handling + PennyRail's cheapest Base-USDC
    // endpoint. The hard $0.30 ceiling prevents a changed quote from spending more.
    const paidFetch = await paidFetchBaseUsdcCapped(0.30);
    const verifyUrl = `${X402_LIST}/api/v1/services/${encodeURIComponent(listing.slug)}/verify-live`;
    const response = await paidFetch(verifyUrl, {
      method: "POST",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    const body = await readJson(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `x402 List verify-live HTTP ${response.status}`,
          stage: "verify-live",
          paidUsdMax: 0.30,
          listingBefore: listing,
          response: body,
        },
        { status: 502 },
      );
    }

    // Refresh the directory row after the paid delivery probe.
    const after = await findPennyRail(origin);

    return NextResponse.json({
      ok: true,
      stage: "verified",
      paidUsdMax: 0.30,
      listingBefore: listing,
      listing: after.listing,
      response: body,
      note: "This paid directory probe is a trust/distribution test, not organic customer revenue.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "x402 List verification failed",
        stage: "verify-live",
        paidUsdMax: 0.30,
      },
      { status: 500 },
    );
  }
}
