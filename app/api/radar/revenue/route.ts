import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = publicOrigin(req);
  const payTo = (process.env.PENNYRAIL_PAY_TO || "").toLowerCase();

  try {
    const url = "https://agent402.tools/api/leaderboard?top=500&include=external&sort=usd&window=7d";
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok || !body) {
      return NextResponse.json({
        error: "Revenue source unavailable",
        status: response.status,
        source: "Agent402 on-chain leaderboard",
        preview: body || text.slice(0, 500),
      }, { status: 502 });
    }

    const rows = Array.isArray(body.leaderboard) ? body.leaderboard : [];
    const seller = rows.find((row: any) => {
      const wallets = [
        row?.wallet,
        ...(Array.isArray(row?.wallets) ? row.wallets : []),
      ].filter(Boolean).map((x: string) => String(x).toLowerCase());

      const origins = [
        row?.homepage,
        ...(Array.isArray(row?.origins) ? row.origins : []),
      ].filter(Boolean).map((x: string) => String(x).replace(/\/$/, "").toLowerCase());

      return (payTo && wallets.includes(payTo)) ||
        origins.includes(origin.toLowerCase());
    }) || null;

    const calls = Number(seller?.callsSettled || 0);
    const earned = Number(seller?.totalUsd || 0);
    const buyers = Number(seller?.uniqueBuyers || 0);

    return NextResponse.json({
      ok: true,
      source: "Agent402 on-chain Base USDC leaderboard",
      asOf: body.asOf || null,
      window: body.windowServed || body.windowLabel || "7d",
      refreshes: "hourly",
      sellerFound: Boolean(seller),
      revenue: {
        outsideCalls: calls,
        earnedUsd: earned,
        payingBots: buyers,
        firstSale: calls > 0,
        rank: seller?.rank ?? null,
      },
      seller: seller ? {
        name: seller.name || "PennyRail",
        wallet: seller.wallet || payTo,
        callsSettled: calls,
        totalUsd: earned,
        uniqueBuyers: buyers,
        rank: seller.rank ?? null,
        endpoints: seller.endpoints ?? null,
      } : null,
      basescan: payTo
        ? `https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913?a=${payTo}`
        : null,
      note: seller
        ? "On-chain seller activity found."
        : "No outside PennyRail settlement is visible in the current leaderboard snapshot yet.",
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Revenue monitor failed",
      source: "Agent402 on-chain leaderboard",
    }, { status: 500 });
  }
}
