import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import { x402Server, penny } from "@/lib/x402-server";

const PROBE_TEXT = "PennyRail x402 verification probe.";

const handler = async (req: NextRequest): Promise<NextResponse<any>> => {
  const supplied = req.nextUrl.searchParams.get("text");
  const text = supplied || PROBE_TEXT;
  const words = text.trim() ? text.trim().split(/\s+/) : [];
  const chars = [...text].length;
  const sentences = (text.match(/[.!?]+(?=\s|$)/g) || []).length;
  return NextResponse.json({
    characters: chars,
    words: words.length,
    sentences,
    readingSeconds: Math.max(1, Math.round(words.length / 200 * 60)),
    inputDefaulted: !supplied,
  });
};

export const GET = withX402(
  handler,
  penny("Deterministic text counts: characters, words, sentences, estimated reading seconds."),
  x402Server,
);
