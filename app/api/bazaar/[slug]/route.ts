import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer } from "@x402/next";
import { BAZAAR_GAP_PRODUCTS, bazaarGapHttpServer, type BazaarGapProduct } from "@/lib/x402-bazaar";
import { runGapArbitragePrimitive } from "@/lib/gap-arbitrage-primitives";

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  try {
    const slug = req.nextUrl.pathname.split("/").filter(Boolean).pop() || "";
    const product = BAZAAR_GAP_PRODUCTS.find((item: BazaarGapProduct) => item.slug === slug);
    if (!product) {
      return NextResponse.json({ error: "Unknown Bazaar product." }, { status: 404 });
    }

    let body: any = null;
    try { body = await req.json(); } catch {}
    const input = body?.input ?? body ?? product.sampleInput;
    const result = await runGapArbitragePrimitive(product.id, input);

    return NextResponse.json({
      ok: true,
      productId: product.id,
      title: product.title,
      priceUsd: product.priceUsd,
      discoverySurface: "coinbase-bazaar",
      strategy: "radar-gap-arbitrage",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bazaar gap product failed" },
      { status: 400 },
    );
  }
};

export const POST = withX402FromHTTPServer(handler, bazaarGapHttpServer);
