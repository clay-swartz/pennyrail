import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";
const TRACK=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','msclkid','mc_cid','mc_eid'];
const handler=async(req:NextRequest): Promise<NextResponse<any>>=>{const raw=req.nextUrl.searchParams.get('url');if(!raw)return NextResponse.json({error:'url query parameter required'},{status:400});try{const u=new URL(raw);const removed:string[]=[];for(const k of [...u.searchParams.keys()]){if(TRACK.includes(k)||k.startsWith('utm_')){removed.push(k);u.searchParams.delete(k)}}u.hash='';return NextResponse.json({url:u.toString(),removed})}catch{return NextResponse.json({error:'invalid absolute URL'},{status:400})}};
export const GET=withX402(handler,penny('Remove common advertising/tracking query parameters from an absolute URL.'),x402Server);
