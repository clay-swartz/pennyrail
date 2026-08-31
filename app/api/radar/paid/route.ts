import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetch } from "@/lib/radar-buyer";
export const dynamic = "force-dynamic";
export async function GET(req:NextRequest){
  if(!isRadarAdmin(req)) return NextResponse.json({error:'unauthorized'},{status:401});
  try{
    const pf=await paidFetch();
    const [d,b]=await Promise.all([
      pf("https://agent402.tools/api/demand-radar?sort=count&limit=20&minCount=1"),
      pf("https://agent402.tools/api/bestsellers?days=30&sort=buyers&limit=20"),
    ]);
    const demand=await d.json(); const bestsellers=await b.json();
    return NextResponse.json({generatedAt:new Date().toISOString(),estimatedIntelSpendUsd:0.01,demand,bestsellers});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'unknown error'},{status:500})}
}
