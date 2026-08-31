import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// v41: revenue intelligence refreshes hourly when invoked.
// The scheduled hourly GitHub workflow guarantees an invocation even when
// external crawler traffic is quiet. The audit itself hard-caps paid
// intelligence spend at $0.01 per fresh refresh.
const cachedRevenueAudit = unstable_cache(
  async (_configurationSignature: string) => runRevenueAudit(),
  ["pennyrail-autonomous-demand-sniper-v41"],
  { revalidate: 3_600 },
);

function configurationSignature() {
  return [
    `openai:${process.env.OPENAI_API_KEY?.trim() ? "1" : "0"}`,
    `demandRadar:${process.env.PENNYRAIL_ENABLE_DEMAND_RADAR === "1" ? "1" : "0"}`,
  ].join("|");
}

export async function getCachedRevenueAudit() {
  return cachedRevenueAudit(configurationSignature());
}
