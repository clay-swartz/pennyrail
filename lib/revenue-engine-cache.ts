import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// One shared paid-intelligence market snapshot per six hours.
// Bump this key whenever audit semantics/capability pricing changes so a new
// deployment never reuses a previous version's market-to-product mapping.
export const getCachedRevenueAudit = unstable_cache(
  async () => runRevenueAudit(),
  ["pennyrail-revenue-broker-v36"],
  { revalidate: 21_600 },
);
