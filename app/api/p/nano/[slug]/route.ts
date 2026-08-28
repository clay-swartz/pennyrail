import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("nano"),
  penny("PennyRail demand-aligned deterministic micro-product.", "$0.001"),
  x402Server,
);
