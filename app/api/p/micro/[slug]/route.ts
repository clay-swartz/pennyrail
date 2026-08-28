import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";
import { createRevenueHandler } from "@/lib/revenue-route";

export const POST = withX402(
  createRevenueHandler("micro"),
  penny("PennyRail demand-built machine data product.", "$0.004"),
  x402Server,
);
