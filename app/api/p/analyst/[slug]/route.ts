import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("analyst"),
  penny("PennyRail high-value analyst capability.", "$0.20"),
  x402Server,
);
