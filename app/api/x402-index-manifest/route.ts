import { NextRequest, NextResponse } from "next/server";
import { GET as getLegacyManifest } from "@/app/api/x402-manifest/route";

export const dynamic = "force-dynamic";

function safePath(value: string) {
  try {
    return new URL(value).pathname || "/";
  } catch {
    return value.startsWith("/") ? value : "/";
  }
}

export async function GET(req: NextRequest) {
  const legacyResponse = await getLegacyManifest(req);
  const manifest: any = await legacyResponse.json();

  const featured: any[] = Array.isArray(manifest?.routing?.featured)
    ? manifest.routing.featured
    : [];

  const tools = featured
    .filter(item => item?.resource && Number(item?.priceUsd) > 0)
    .map((item, index) => {
      const intents = Array.isArray(item.intents)
        ? item.intents.filter(Boolean)
        : [];
      const path = safePath(String(item.resource));
      const priceUsd = Number(item.priceUsd);

      return {
        name:
          intents[0] ||
          item.title ||
          item.id ||
          `pennyrail_${index + 1}`,
        route: path,
        endpoint: item.resource,
        method: String(item.method || "POST").toUpperCase(),
        price_usd: priceUsd,
        price: `$${priceUsd}`,
        description: item.description || intents.join(", "),
        tags: intents.slice(0, 12),
        network:
          manifest?.payment?.x402?.primaryNetwork || "eip155:8453",
      };
    });

  const origin = req.nextUrl.origin.replace(/\/$/, "");
  const network =
    manifest?.payment?.x402?.primaryNetwork || "eip155:8453";

  const ensure = (tool: any) => {
    if (!tools.some(existing => existing.route === tool.route)) {
      tools.push(tool);
    }
  };

  ensure({
    name: "url_contents",
    route: "/api/agent/url-contents",
    endpoint: `${origin}/api/agent/url-contents`,
    method: "POST",
    price_usd: 0.001,
    price: "$0.001",
    description:
      "Retrieve clean text and optional highlights from known public URLs for agent research, RAG and page-reading workflows.",
    tags: [
      "retrieve content from URLs",
      "URL contents",
      "extract page text",
      "web extraction",
      "scrape URL",
      "page reader",
      "RAG",
      "research",
    ],
    network,
  });

  ensure({
    name: "agent_execution",
    route: "/v1/agents/execute",
    endpoint: `${origin}/v1/agents/execute`,
    method: "POST",
    price_usd: 0.75,
    price: "$0.75",
    description:
      "Bounded AI agent execution for research, analysis, code/data work and machine-ready answers.",
    tags: [
      "agent",
      "execution",
      "research",
      "analysis",
      "code",
      "data",
      "automation",
    ],
    network,
  });

  return NextResponse.json(
    {
      ...manifest,
      version: 1,
      tools,
      capabilities: {
        ...(manifest?.capabilities || {}),
        tools: tools.length,
        priceBearingTools: tools.length,
      },
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300",
      },
    },
  );
}
