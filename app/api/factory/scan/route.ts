import { NextRequest, NextResponse } from "next/server";
import { paidFetch } from "@/lib/radar-buyer";
import { FACTORY_CAPABILITIES, matchCapability } from "@/lib/factory";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, any>;

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) && req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

function bestsellerRows(payload: any): AnyRow[] {
  return Array.isArray(payload?.bestsellers) ? payload.bestsellers : [];
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const pf = await paidFetch();
    const [demandRes, bestRes] = await Promise.all([
      pf("https://agent402.tools/api/demand-radar?sort=count&limit=30&minCount=1"),
      pf("https://agent402.tools/api/bestsellers?days=30&sort=buyers&limit=30"),
    ]);
    const demand = await demandRes.json();
    const bestsellers = await bestRes.json();
    if (!demandRes.ok) return NextResponse.json({ error:"Demand Radar purchase failed", status:demandRes.status, demand }, { status:502 });
    if (!bestRes.ok) return NextResponse.json({ error:"Bestsellers purchase failed", status:bestRes.status, bestsellers }, { status:502 });

    const bestsellerSlugs = new Set(bestsellerRows(bestsellers).map((x:any)=>String(x.slug||"").toLowerCase()));
    const radar = Array.isArray(demand?.radar) ? demand.radar : [];

    const ranked = radar
      .filter((r:any)=>r && !r.noise)
      .map((r:any)=>{
        const match = matchCapability(String(r.text||""));
        const count = Number(r.count||0);
        const explicit = r.signalType === "explicit-request";
        const near = Boolean(r.nearThreshold);
        const score = count*10 + (explicit?20:r.signalType==="mixed"?8:-12) + (near?12:0) + (match?Math.min(20,match.score):0);
        return {
          need:r.text,
          demandSignals:count,
          signalType:r.signalType,
          nearThreshold:near,
          gapToThreshold:r.gapToThreshold,
          score,
          status:match ? "AUTO-LIVE" : "NEEDS-BUILDER",
          operation:match?.capability.id || null,
          capability:match?.capability.title || null,
          inputHint:match?.capability.inputHint || null,
          priceUsd:match ? 0.003 : null,
          alreadySellingPopularEquivalent: match ? bestsellerSlugs.has(match.capability.id.split(".").pop()||"") : false,
        };
      })
      .sort((a:any,b:any)=>b.score-a.score)
      .slice(0,8);

    return NextResponse.json({
      ok:true,
      generatedAt:new Date().toISOString(),
      intelSpendUsd:0.01,
      demandSummary:{ totalWishes:demand?.totalWishes, distinctClusters:demand?.distinctClusters, matchedClusters:demand?.matchedClusters, buildThreshold:demand?.buildThreshold },
      factory:{ liveCapabilities:FACTORY_CAPABILITIES.length, paidRunPriceUsd:0.003, autoLive:ranked.filter((x:any)=>x.status==="AUTO-LIVE").length, needsBuilder:ranked.filter((x:any)=>x.status==="NEEDS-BUILDER").length },
      opportunities:ranked,
      note:"AUTO-LIVE means PennyRail can serve that class of request immediately through /api/factory/run without another deployment. NEEDS-BUILDER means the demand is real but requires a new connector/recipe.",
    });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error?error.message:"factory scan failed", hint:"If this is an insufficient-funds/payment error, fund the PennyRail buyer wallet with Base-mainnet USDC." }, { status:500 });
  }
}
