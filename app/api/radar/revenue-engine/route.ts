import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { auditBazaarMarket } from "@/lib/bazaar-market-radar";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) { return isRadarAdmin(req); }

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const audit = await getCachedRevenueAudit();

    // One operator action now answers both questions:
    // 1) what is agents' paid/unmet demand?
    // 2) does Coinbase Bazaar currently expose PennyRail and competing supply?
    const bazaarMarket = await auditBazaarMarket(audit as Record<string, any>);

    return NextResponse.json({
      ...audit,
      bazaarMarket,
      revenueDecision: {
        nextAction: bazaarMarket.nextAction,
        rule:
          "Do not add inventory unless Radar shows MISSING or UNDERCUTTABLE supply, or a current PennyRail winner is already converting.",
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Revenue Engine audit failed",
    }, { status: 500 });
  }
}
