import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// One shared paid-intelligence market snapshot per six hours. v34's calls are
// hard-capped at $0.005 each for Demand Radar + Bestsellers ($0.01/audit).
export const getCachedRevenueAudit = unstable_cache(
  async () => runRevenueAudit(),
  ["pennyrail-revenue-multiplier-v34"],
  { revalidate: 21_600 },
);
