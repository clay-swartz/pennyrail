import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Wix Restaurant Inventory",
    version: "v0",
    wixAppId: process.env.WIX_APP_ID?.trim() || "4bcf52e1-f9c8-45aa-a922-4e2ec697b590",
    configured: {
      appSecret: Boolean(process.env.WIX_APP_SECRET?.trim()),
      webhookPublicKey: Boolean(process.env.WIX_WEBHOOK_PUBLIC_KEY?.trim()),
    },
  }, { headers: { "cache-control": "no-store" } });
}
