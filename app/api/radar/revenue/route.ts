import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";

export const dynamic = "force-dynamic";

function publicOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

async function jsonFetch(url: string) {
  try {
    const response = await fetch(url, { cache:"no-store", headers:{accept:"application/json"}, signal:AbortSignal.timeout(8000) });
    const text = await response.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return { ok:response.ok, status:response.status, body };
  } catch (error) {
    return { ok:false, status:0, body:null, error:error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error:"unauthorized" }, { status:401 });
  }

  const origin = publicOrigin(req);
  const payTo = (process.env.PENNYRAIL_PAY_TO || "").toLowerCase();

  const [agent402Result, x402ListResult] = await Promise.all([
    jsonFetch("https://agent402.tools/api/leaderboard?top=500&include=external&sort=usd&window=7d"),
    jsonFetch("https://x402-list.com/api/v1/services/pennyrail"),
  ]);

  const body = agent402Result.body;
  const rows = Array.isArray(body?.leaderboard) ? body.leaderboard : [];
  const seller = rows.find((row: any) => {
    const wallets = [row?.wallet, ...(Array.isArray(row?.wallets) ? row.wallets : [])]
      .filter(Boolean).map((x:string)=>String(x).toLowerCase());
    const origins = [row?.homepage, ...(Array.isArray(row?.origins) ? row.origins : [])]
      .filter(Boolean).map((x:string)=>String(x).replace(/\/$/,"").toLowerCase());
    return (payTo && wallets.includes(payTo)) || origins.includes(origin.toLowerCase());
  }) || null;

  const agent402 = {
    available: agent402Result.ok,
    window: body?.windowServed || body?.windowLabel || "7d",
    calls: Number(seller?.callsSettled || 0),
    earnedUsd: Number(seller?.totalUsd || 0),
    uniqueBuyers: Number(seller?.uniqueBuyers || 0),
    rank: seller?.rank ?? null,
    asOf: body?.asOf || null,
  };

  const listing = x402ListResult.body?.data || x402ListResult.body || null;
  const traction = listing?.assessment?.traction || {};
  const x402List = {
    available: x402ListResult.ok,
    verified: Boolean(listing?.verified),
    status: listing?.status || null,
    endpointCount: Number(listing?.endpoint_count || 0),
    volumeUsd30d: Number(traction?.volume_usd_30d || 0),
    txCount30d: Number(traction?.tx_count_30d || 0),
    uniqueBuyers30d: Number(traction?.unique_buyers_30d || 0),
    volumeUsdAllTimeFloor: Number(traction?.volume_usd_all_time || 0),
    txCountAllTimeFloor: Number(traction?.tx_count_all_time || 0),
    firstSettlementAt: traction?.first_settlement_at || null,
    lastSettlementAt: traction?.last_settlement_at || null,
    caveat: traction?.caveat || null,
  };

  // Either source detecting a settlement is enough to flip the operator signal.
  // Keep the headline earnedUsd aligned with the existing UI's 7d label, while
  // exposing x402 List's broader measured floor in multiRail below.
  const outsideDetected =
    agent402.calls > 0 ||
    x402List.txCount30d > 0 ||
    x402List.txCountAllTimeFloor > 0;

  return NextResponse.json({
    ok: agent402Result.ok || x402ListResult.ok,
    source: "multi-rail on-chain revenue monitor",
    asOf: new Date().toISOString(),
    revenue: {
      outsideCalls: Math.max(agent402.calls, x402List.txCount30d),
      earnedUsd: agent402.earnedUsd,
      payingBots: Math.max(agent402.uniqueBuyers, x402List.uniqueBuyers30d),
      firstSale: outsideDetected,
      rank: agent402.rank,
    },
    multiRail: {
      agent402,
      x402List,
    },
    basescan: payTo
      ? `https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913?a=${payTo}`
      : null,
    note: outsideDetected
      ? "At least one outside settlement is visible in the measured rails. Internal Bazaar seeds must still be excluded when judging organic traction."
      : "No outside PennyRail settlement is visible in either measured rail yet.",
  });
}
