import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("premium"),
  penny("PennyRail premium agent capability.", "$0.02"),
  x402Server,
);
