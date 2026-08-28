import { unstable_cache } from "next/cache";
import { runRevenueAudit } from "@/lib/revenue-engine";

// One shared market snapshot per six hours. Vercel's daily cron guarantees a warm refresh even when traffic is quiet, so
// PennyRail can keep adapting without an operator opening the dashboard.
export const getCachedRevenueAudit = unstable_cache(
  async () => runRevenueAudit(),
  ["pennyrail-autonomous-gap-factory-v33"],
  { revalidate: 21_600 },
);
