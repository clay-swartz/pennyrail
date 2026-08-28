import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("standard"),
  penny("PennyRail multi-step machine utility product.", "$0.01"),
  x402Server,
);
