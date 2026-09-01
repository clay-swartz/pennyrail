import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { activateThe402Provider } from "@/lib/the402";
import { sweepThe402RequestsWithGapFallback } from "@/lib/gap-bidder";
import { scanAgenteryPain } from "@/lib/agentery-pain";
import { scanLeadYield } from "@/lib/lead-yield";

export const dynamic = "force-dynamic";

function publicOrigin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

async function republishAgent402() {
  try {
    const response = await fetch("https://agent402.tools/api/index/register", {
      method:"POST",
      headers:{"content-type":"application/json",accept:"application/json"},
      body:JSON.stringify({origin:publicOrigin()}),
      cache:"no-store",
      signal:AbortSignal.timeout(12_000),
    });
    const raw=await response.text();
    let body:any=raw; try{body=raw?JSON.parse(raw):null}catch{}
    return {ok:response.ok,status:response.status,response:body};
  } catch (error) {
    return {ok:false,error:error instanceof Error?error.message:String(error)};
  }
}

const cachedOutboundSweep = unstable_cache(async () => {
  const participantId = process.env.THE402_PARTICIPANT_ID?.trim() || "";
  const apiKey = process.env.THE402_API_KEY?.trim() || "";
  const webhookSecret = process.env.THE402_WEBHOOK_SECRET?.trim() || "";
  if (!participantId || !apiKey || !webhookSecret) return { configured: false };
  try {
    const activation = await activateThe402Provider({
      participantId,
      apiKey,
      webhookUrl: `${publicOrigin()}/api/the402/webhook`,
    });
    const sweep = await sweepThe402RequestsWithGapFallback(apiKey, 25);
    return {
      configured: true,
      servicesLive: Array.isArray(activation.services) ? activation.services.length : null,
      createdThisRun: activation.createdCount,
      checked: sweep.checked,
      bidsPlaced: sweep.bidsPlaced,
      existingCapabilityBids: sweep.existingCapabilityBids,
      gapBids: sweep.gapBids,
      unresolvedObserved: sweep.unresolvedObserved,
      bidResults: sweep.results,
    };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : String(error) };
  }
}, ["pennyrail-the402-outbound-v52"], { revalidate: 900 });

const cachedPainRadar = unstable_cache(
  async () => scanAgenteryPain(),
  ["pennyrail-agentery-pain-v52"],
  { revalidate: 21_600 },
);

const cachedLeadYieldRadar = unstable_cache(
  async () => scanLeadYield(),
  ["pennyrail-lead-yield-v53"],
  { revalidate: 21_600 },
);

export async function GET() {
  const [audit, outbound, agent402, pain, leadYield] = await Promise.all([
    getCachedRevenueAudit(),
    cachedOutboundSweep(),
    republishAgent402(),
    cachedPainRadar(),
    cachedLeadYieldRadar(),
  ]);

  return NextResponse.json({
    ok: true,
    generatedAt: audit.generatedAt,
    mode: "MONEY_PLUS_PAIN_PLUS_LEAD_YIELD_V53",
    sources: audit.sources,
    portfolio: audit.portfolio,
    opportunityCounts: {
      autoLive: audit.autoLive?.length || 0,
      unresolved: audit.unresolved?.length || 0,
      agenteryUnresolved: pain?.unresolvedGaps?.length || 0,
      leadYieldObserved: leadYield?.economics?.payoutRowsObserved || 0,
    },
    intelligenceSpendUsdThisAudit: audit.economics?.intelligenceSpendUsdThisAudit ?? 0,
    intelligenceSpendCapUsdPerAudit: audit.economics?.intelligenceSpendCapUsdPerAudit ?? 0.01,
    outboundThe402: outbound,
    painRadar: pain,
    leadYieldRadar: leadYield,
    distribution: { agent402Reindex: agent402 },
  });
}
