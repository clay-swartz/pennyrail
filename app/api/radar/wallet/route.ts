import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { fundRadarBuyerTestUsdc, radarBuyerAddress } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) { return isRadarAdmin(req); }

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const evmAddress = await radarBuyerAddress();
    return NextResponse.json({
      environment: "Base Sepolia / testnet",
      evmAddress,
      note: "This Coinbase CDP-managed EVM wallet is PennyRail's automated Radar buyer."
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "unknown error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { address: evmAddress, transactionHash } = await fundRadarBuyerTestUsdc();
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
