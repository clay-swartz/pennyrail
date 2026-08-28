import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("network"),
  penny("PennyRail demand-aligned network micro-product.", "$0.003"),
  x402Server,
);
