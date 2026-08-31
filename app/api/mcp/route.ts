import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { findRouterCandidates, quoteRouterIntent } from "@/lib/transaction-router";

export const dynamic = "force-dynamic";

function publicOrigin() {
  return (process.env.PENNYRAIL_PUBLIC_URL?.trim() || "https://pennyrail.vercel.app").replace(/\/$/, "");
}

function absoluteUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${publicOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

function withAbsoluteUrls(value: any): any {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(withAbsoluteUrls);
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if ((key === "executeUrl" || key === "productUrl") && typeof item === "string") out[key] = absoluteUrl(item);
    else out[key] = withAbsoluteUrls(item);
  }
  return out;
}

const handler = createMcpHandler(() => {
  const server = new McpServer(
    { name: "PennyRail Transaction Router", version: "0.9.0" },
    {
      instructions:
        "PennyRail finds and quotes machine capabilities for free. Start with pennyrail_find, then pennyrail_quote. The quote returns an absolute x402-paid executeUrl and exact USD price. Pay/call only that URL; do not guess a paid product.",
    },
  );

  server.registerTool(
    "pennyrail_find",
    {
      title: "Find a machine capability",
      description:
        "Free natural-language discovery across PennyRail's live paid capability portfolio. Returns ranked products, exact prices, input hints, and x402 execute URLs.",
      inputSchema: z.object({
        intent: z.string().min(1).describe("What the agent needs, in natural language."),
        limit: z.number().int().min(1).max(20).optional().describe("Maximum candidates to return."),
      }),
    },
    async ({ intent, limit }: { intent: string; limit?: number }) => {
      const candidates = withAbsoluteUrls(findRouterCandidates(intent, limit ?? 8));
      const payload = {
        ok: true,
        service: "PennyRail Transaction Router",
        mode: "free-discovery",
        intent,
        candidates,
        next: "Call pennyrail_quote with the chosen productId, then pay/call only the returned executeUrl.",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    },
  );

  server.registerTool(
    "pennyrail_quote",
    {
      title: "Quote a PennyRail capability",
      description:
        "Free exact quote for a PennyRail product. Returns the x402 paid execution URL, exact USD price, tier, and sample input. No payment is made by this tool.",
      inputSchema: z
        .object({
          productId: z.string().min(1).optional().describe("Exact productId returned by pennyrail_find."),
          intent: z.string().min(1).optional().describe("Natural-language need when productId is not known."),
        })
        .refine((value: { productId?: string; intent?: string }) => Boolean(value.productId || value.intent), { message: "productId or intent is required" }),
    },
    async ({ productId, intent }: { productId?: string; intent?: string }) => {
      const result = withAbsoluteUrls(quoteRouterIntent({ productId, intent }));
      const payload = {
        ...result,
        paymentProtocol: "x402",
        network: "eip155:8453",
        currency: "USDC",
        instruction: result?.ok
          ? "Pay/call only quote.executeUrl with the quoted productId and input."
          : "Choose a clearer candidate before paying.",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        structuredContent: payload,
        isError: !result?.ok,
      };
    },
  );

  return server;
});

export async function GET(req: Request) {
  return handler.fetch(req);
}

export async function POST(req: Request) {
  return handler.fetch(req);
}

export async function DELETE(req: Request) {
  return handler.fetch(req);
}
