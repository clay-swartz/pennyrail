import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// Market intelligence remains shared for six hours, but runtime capability
// configuration is part of the cache identity. Adding/removing an upstream
// key can therefore never leave PennyRail advertising a stale portfolio.
const cachedRevenueAudit = unstable_cache(
  async (_configurationSignature: string) => runRevenueAudit(),
  ["pennyrail-transaction-router-v37"],
  { revalidate: 21_600 },
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
