import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(_req: NextRequest) {
  return NextResponse.json({ deprecated: true, note: "Bazaar testing disabled." }, { status: 410 });
}
