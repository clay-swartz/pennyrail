import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { activateThe402Provider, sweepThe402Requests } from "@/lib/the402";

export const dynamic = "force-dynamic";

function publicOrigin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
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
    const sweep = await sweepThe402Requests(apiKey, 25);
    return {
      configured: true,
      servicesLive: Array.isArray(activation.services) ? activation.services.length : null,
      createdThisRun: activation.createdCount,
      checked: sweep.checked,
      bidsPlaced: sweep.bidsPlaced,
    };
  } catch (error) {
    return { configured: true, error: error instanceof Error ? error.message : String(error) };
  }
}, ["pennyrail-the402-outbound-v34"], { revalidate: 900 });

// Safe for Vercel/GitHub cron. Paid intelligence is cached for six hours and
// hard-capped at $0.01 per refresh. Outbound marketplace maintenance/sweeping
// is cached for 15 minutes so repeated public hits cannot hammer provider APIs.
export async function GET() {
  const [audit, outbound] = await Promise.all([
    getCachedRevenueAudit(),
    cachedOutboundSweep(),
  ]);
  return NextResponse.json({
    ok: true,
    generatedAt: audit.generatedAt,
    mode: audit.mode,
    sources: audit.sources,
    portfolio: audit.portfolio,
    opportunityCounts: {
      autoLive: audit.autoLive?.length || 0,
      unresolved: audit.unresolved?.length || 0,
    },
    intelligenceSpendUsdThisAudit: audit.economics?.intelligenceSpendUsdThisAudit ?? 0,
    intelligenceSpendCapUsdPerAudit: audit.economics?.intelligenceSpendCapUsdPerAudit ?? 0.01,
    outboundThe402: outbound,
  });
}
