import { NextRequest, NextResponse } from "next/server";
import { quoteRouterIntent } from "@/lib/transaction-router";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const result = quoteRouterIntent({ intent:req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("intent"), productId:req.nextUrl.searchParams.get("productId") });
  return NextResponse.json(result, { status: result.ok ? 200 : 409, headers:{"cache-control":"no-store"} });
}

export async function POST(req: NextRequest) {
  let body:any = {};
  try { body = await req.json(); } catch {}
  const result = quoteRouterIntent({ intent:body?.intent, productId:body?.productId ?? body?.product_id });
  return NextResponse.json(result, { status: result.ok ? 200 : 409, headers:{"cache-control":"no-store"} });
}
