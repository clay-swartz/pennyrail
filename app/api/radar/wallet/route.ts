import { NextRequest, NextResponse } from "next/server";
import { CdpClient } from "@coinbase/cdp-sdk";
import { radarBuyerAddresses } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  return Boolean(process.env.RADAR_ADMIN_TOKEN) &&
    req.headers.get("x-admin-token") === process.env.RADAR_ADMIN_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const addresses = await radarBuyerAddresses();
    return NextResponse.json({
      environment: "Base Sepolia / testnet",
      evmAddress: addresses.evmAddress,
      svmAddress: addresses.svmAddress,
      note: "This CDP-managed EVM wallet is PennyRail's automated Radar buyer."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { evmAddress } = await radarBuyerAddresses();
    const cdp = new CdpClient();
    const { transactionHash } = await cdp.evm.requestFaucet({
      address: evmAddress,
      network: "base-sepolia",
      token: "usdc"
    });
    return NextResponse.json({
      funded: true,
      network: "base-sepolia",
      token: "USDC",
      evmAddress,
      transactionHash,
      note: "Test USDC requested from the Coinbase faucet. It may take a short time to confirm."
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "unknown error",
      note: "The faucet may already have funded this wallet or the project faucet limit may have been reached."
    }, { status: 500 });
  }
}
