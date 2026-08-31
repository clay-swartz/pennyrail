import { createRouterFrontdoor } from "@/lib/agent-frontdoors";
export const POST = createRouterFrontdoor({
  productId: "ai.chat-mini",
  tier: "premium",
  price: "$0.009",
  description: "Low-cost GPT-4o-mini chat completion for AI agents with tools and structured output support. OpenAI-compatible machine inference without signup.",
  probeInput: { messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 16 },
});
