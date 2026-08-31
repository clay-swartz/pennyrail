import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("mini"),
  penny("PennyRail market-priced micro utility.", "$0.002"),
  x402Server,
);
