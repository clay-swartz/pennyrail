import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(){
  const [indexRes, leaderboardRes] = await Promise.all([
    fetch("https://agent402.tools/api/index",{cache:"no-store"}),
    fetch("https://agent402.tools/api/leaderboard?include=external",{cache:"no-store"}),
  ]);
  const index = indexRes.ok ? await indexRes.json() : {error:`index ${indexRes.status}`};
  const leaderboard = leaderboardRes.ok ? await leaderboardRes.json() : {error:`leaderboard ${leaderboardRes.status}`};
  return NextResponse.json({generatedAt:new Date().toISOString(),index,leaderboard});
}
