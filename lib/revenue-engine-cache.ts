import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// v41: once the operator enables PENNYRAIL_ENABLE_DEMAND_RADAR=1 in Production,
// gap intelligence becomes continuous revenue infrastructure. Refresh hourly.
// runRevenueAudit hard-caps Agent402 intelligence spend at $0.01 per fresh audit
// ($0.005 demand radar + $0.005 bestsellers).
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
