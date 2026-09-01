import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { runMoneyRadar } from "@/lib/money-radar";

export const dynamic = "force-dynamic";

// Public market/reward data only. Cache for five minutes so repeated checks do not
// hammer exchange APIs while still staying useful for paper opportunity ranking.
const cached = unstable_cache(
  async () => runMoneyRadar(),
  ["pennyrail-money-radar-v46"],
  { revalidate: 300 },
);

export async function GET() {
  try {
    return NextResponse.json(await cached(), {
      headers: { "cache-control": "public, max-age=30, s-maxage=300" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok:false, error:error instanceof Error ? error.message : String(error) },
      { status:500 },
    );
  }
}
