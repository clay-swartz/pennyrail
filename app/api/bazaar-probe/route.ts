import { NextRequest, NextResponse } from "next/server";
export async function GET(_req: NextRequest) {
  return NextResponse.json({ deprecated: true, note: "Bazaar probe disabled." }, { status: 410 });
}
