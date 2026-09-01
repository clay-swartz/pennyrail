import { NextRequest, NextResponse } from "next/server";
import { GET as getLegacyManifest } from "@/app/api/x402-manifest/route";

export const dynamic = "force-dynamic";

function safePath(value: string) {
  try { return new URL(value).pathname || "/"; }
  catch { return value.startsWith("/") ? value : "/"; }
}

export async function GET(req: NextRequest) {
  const legacyResponse = await getLegacyManifest(req);
  const manifest: any = await legacyResponse.json();

  const featured: any[] = Array.isArray(manifest?.routing?.featured)
    ? manifest.routing.featured
    : [];

  // Agent402 supports a price-bearing `tools` array. PennyRail previously
  // advertised most resources only as bare URL strings, which can leave the
  // external router unable to rank us by price until it performs a live probe.
  const tools = featured
    .filter(item => item?.resource && Number(item?.priceUsd) > 0)
    .map((item, index) => {
      const intents = Array.isArray(item.intents) ? item.intents.filter(Boolean) : [];
      const path = safePath(String(item.resource));
      const priceUsd = Number(item.priceUsd);
      return {
        name: intents[0] || item.title || item.id || `pennyrail_${index + 1}`,
        route: path,
        endpoint: item.resource,
        method: String(item.method || "POST").toUpperCase(),
        price_usd: priceUsd,
        price: `$${priceUsd}`,
        description: item.description || intents.join(", "),
        tags: intents.slice(0, 12),
        network: manifest?.payment?.x402?.primaryNetwork || "eip155:8453",
      };
    });

  const origin = req.nextUrl.origin.replace(/\/$/, "");
  const agentExecutionPath = "/v1/agents/execute";

  if (!tools.some(tool => tool.route === agentExecutionPath)) {
    tools.push({
      name: "agent_execution",
      route: agentExecutionPath,
      endpoint: `${origin}${agentExecutionPath}`,
      method: "POST",
      price_usd: 0.75,
      price: "$0.75",
      description: "Bounded AI agent execution for research, analysis, code/data work and machine-ready answers.",
      tags: ["agent", "execution", "research", "analysis", "code", "data", "automation"],
      network: manifest?.payment?.x402?.primaryNetwork || "eip155:8453",
    });
  }

  return NextResponse.json({
    ...manifest,
    // x402scan/Agent402 compatibility.
    version: 1,
    tools,
    capabilities: {
      ...(manifest?.capabilities || {}),
      tools: tools.length,
      priceBearingTools: tools.length,
    },
  }, {
    headers: {
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}
