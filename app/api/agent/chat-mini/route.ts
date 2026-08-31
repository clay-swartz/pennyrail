import { createRouterFrontdoor } from "@/lib/agent-frontdoors";

export const POST = createRouterFrontdoor({
  productId: "ai.chat-mini",
  tier: "premium",
  price: "$0.02",
  description: "Low-cost AI inference for agents: OpenAI-compatible GPT-4o-mini chat completion with bounded output, optional tools and structured response format.",
  probeInput: { messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 16 },
});
