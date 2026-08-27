import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";
const handler=async(req:NextRequest): Promise<NextResponse<any>>=>{const text=req.nextUrl.searchParams.get('text')||'';if(!text)return NextResponse.json({error:'text query parameter required'},{status:400});const words=text.trim()?text.trim().split(/\s+/):[];const chars=[...text].length;const sentences=(text.match(/[.!?]+(?=\s|$)/g)||[]).length;return NextResponse.json({characters:chars,words:words.length,sentences,readingSeconds:Math.max(1,Math.round(words.length/200*60))})};
export const GET=withX402(handler,penny('Deterministic text counts: characters, words, sentences, estimated reading seconds.'),x402Server);
