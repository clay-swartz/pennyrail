import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("skill"),
  penny("PennyRail multi-step agent skill.", "$0.05"),
  x402Server,
);
