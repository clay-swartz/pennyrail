import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// One shared paid-intelligence market snapshot per six hours.
// Bump this cache key whenever audit semantics or capability mapping changes;
// otherwise a new deployment can legally reuse an older build's audit result.
// v35 defaults to Bestsellers-only intelligence at a $0.005 hard cap/audit.
export const getCachedRevenueAudit = unstable_cache(
  async () => runRevenueAudit(),
  ["pennyrail-proven-demand-v35-1"],
  { revalidate: 21_600 },
);
