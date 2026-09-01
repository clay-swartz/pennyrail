import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { GAP_ARBITRAGE_PRODUCTS } from "@/lib/gap-arbitrage-catalog";
import { runGapArbitragePrimitive } from "@/lib/gap-arbitrage-primitives";

function emptyObject(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Record<string,unknown>).length===0);
}

async function requestInput(req: NextRequest, fallback: unknown) {
  try {
    const body = await req.json();
    const value =
      body && typeof body === "object" && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body,"input")
        ? body.input
        : body;
    return value == null || emptyObject(value) ? fallback : value;
  } catch {
    return fallback;
  }
}

export function createGapArbitrageFrontdoor(id:string) {
  const product = GAP_ARBITRAGE_PRODUCTS.find(p=>p.id===id);
  if(!product) throw new Error(`unknown gap-arbitrage product ${id}`);

  const discoveryMetadata = product.id === "browser.render"
    ? {
        serviceName: "PennyRail Browser Render",
        tags: ["browser", "render", "markdown", "web", "agents"],
      }
    : undefined;

  const handler = async (req:NextRequest):Promise<NextResponse<any>> => {
    try {
      const input = await requestInput(req, product.sampleInput);
      const result = await runGapArbitragePrimitive(product.id,input);
      return NextResponse.json({
        ok:true,
        productId:product.id,
        title:product.title,
        priceUsd:product.priceUsd,
        acquisitionSurface:"pennyrail-paid-gap-arbitrage",
        result,
      });
    } catch (error) {
      return NextResponse.json({error:error instanceof Error?error.message:"PennyRail execution failed"},{status:400});
    }
  };
  return withX402(
    handler,
    penny(product.description, `$${product.priceUsd}`, discoveryMetadata),
    x402Server,
  );
}
