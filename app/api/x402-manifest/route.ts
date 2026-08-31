import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";
import { staticRevenueProductRoutes, type RevenueProductRoute } from "@/lib/revenue-engine";
import { getCachedRevenueAudit } from "@/lib/revenue-engine-cache";
import { BAZAAR_WEB_SEARCH_PATH } from "@/lib/x402-bazaar";
import { GAP_ARBITRAGE_PRODUCTS } from "@/lib/gap-arbitrage-catalog";

export const dynamic = "force-dynamic";

function cleanOrigin(req: NextRequest) {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return req.nextUrl.origin.replace(/\/$/, "");
}

const DEMAND_SNIPERS = [
  { path:"/api/agent/random", priceUsd:0.001, intents:["random","secure random","random bytes","random integer","cryptographic randomness"], description:"Cryptographically secure randomness for repeated agent workflows." },
  { path:"/api/agent/uuid", priceUsd:0.001, intents:["uuid","uuid generator","uuid v4","uuid v7","generate uuid"], description:"UUID v4/v7 generation for repeated machine workflows." },
  { path:"/api/agent/hash", priceUsd:0.001, intents:["hash","hashing","sha256","sha512","sha-256","sha-512","cryptographic hash","digest","checksum"], description:"SHA-256/SHA-512/SHA-1/MD5 hashing with hex and Base64 digests." },
  { path:"/api/agent/base64-decode", priceUsd:0.001, intents:["base64","base64 decode","decode base64","encoding"], description:"Base64 decoding to UTF-8." },
  { path:"/api/agent/hex-decode", priceUsd:0.001, intents:["hex","hex decode","decode hex","encoding"], description:"Hexadecimal decoding to UTF-8." },
  { path:"/api/agent/token-count", priceUsd:0.001, intents:["token count","count tokens","llm tokens","bpe tokens","context budget"], description:"Exact OpenAI BPE token counting." },
  { path:"/api/agent/time-convert", priceUsd:0.001, intents:["time convert","epoch to iso","iso to epoch","timezone convert","current time"], description:"Epoch/ISO/timezone conversion." },
  { path:"/api/agent/text-stats", priceUsd:0.001, intents:["text stats","word count","character count","line count"], description:"Deterministic text statistics." },
  { path:"/api/agent/dns", priceUsd:0.001, intents:["dns","dns lookup","mx lookup","txt record","cname","a record"], description:"DNS record lookup via DNS-over-HTTPS." },
  { path:"/api/agent/block-number", priceUsd:0.001, intents:["block number","latest block","evm block","onchain read","crypto data"], description:"Latest EVM block number." },
  { path:"/api/agent/weather", priceUsd:0.001, intents:["weather","current weather","weather now","weather by city"], description:"Current global weather." },
  { path:"/api/agent/fx-convert", priceUsd:0.001, intents:["fx","currency conversion","exchange rate","financial data"], description:"Current currency conversion / FX data." },
  { path:"/api/agent/page-metadata", priceUsd:0.001, intents:["page metadata","article metadata","open graph","website metadata","url metadata"], description:"Page/article metadata extraction." },
  { path:"/api/agent/chat-mini", priceUsd:0.009, intents:["inference","chat completion","gpt-4o-mini","openai chat","agent chat"], description:"Low-cost GPT-4o-mini chat inference." },
  { path:"/api/agent/web-search", priceUsd:0.018, intents:["web search","search the web","live web search","current information","latest news","research","fresh sources"], description:"Live web search with current sources." },
];

export async function GET(req: NextRequest) {
  const origin = cleanOrigin(req);
  const mainnet = process.env.X402_MODE?.trim() === "mainnet";
  const payTo = process.env.PENNYRAIL_PAY_TO || "";
  const network = mainnet ? "eip155:8453" : "eip155:84532";
  const revenueAudit = await getCachedRevenueAudit();
  const revenueRoutes: RevenueProductRoute[] = Array.isArray(revenueAudit.productRoutes) && revenueAudit.productRoutes.length
    ? revenueAudit.productRoutes as RevenueProductRoute[]
    : staticRevenueProductRoutes();
  const routerTiers = ["nano","mini","network","micro","intel","standard","premium","skill","analyst"];

  return NextResponse.json({
    spec:"agent402-service-manifest/1",
    x402Version:2,
    version:42,
    name:"PennyRail",
    summary:"Autonomous x402 gap-arbitrage router: watches what agents buy or fail to find, then sells exact-match machine services at the facilitator floor or below observed competing prices.",
    homepage:origin,
    resources:[
      ...GAP_ARBITRAGE_PRODUCTS.map(p=>`${origin}${p.path}`),
      ...DEMAND_SNIPERS.map(item=>`${origin}${item.path}`),
      `${origin}${BAZAAR_WEB_SEARCH_PATH}`,
      `${origin}/api/tools/json-canonicalize`,
      `${origin}/api/tools/text-stats`,
      `${origin}/api/tools/strip-tracking`,
      ...FACTORY_CAPABILITIES.map(c=>`${origin}/api/f/${c.id}`),
      ...revenueRoutes.map(p=>`${origin}${p.path}`),
      ...routerTiers.map(tier=>`${origin}/api/router/execute/${tier}`),
    ],
    payment:{x402:{version:2,currency:"USDC",networks:[network],primaryNetwork:network,priceRange:"$0.001-$0.20",payTo,payToName:"PennyRail",nonCustodial:true}},
    capabilities:{
      strategy:"paid-gap-arbitrage-and-price-sniping",
      demandRadar:process.env.PENNYRAIL_ENABLE_DEMAND_RADAR==="1"?"enabled":"disabled-needs-production-env",
      paidGapFrontdoors:GAP_ARBITRAGE_PRODUCTS.length,
      exactMatchFrontdoors:DEMAND_SNIPERS.length,
      dynamicDemandRoutes:revenueRoutes.filter((r:any)=>r.source==="demand").length,
      totalAdvertisedResources:GAP_ARBITRAGE_PRODUCTS.length+DEMAND_SNIPERS.length+4+FACTORY_CAPABILITIES.length+revenueRoutes.length+routerTiers.length,
    },
    routing:{
      featured:[
        ...GAP_ARBITRAGE_PRODUCTS.map(p=>({
          resource:`${origin}${p.path}`,
          method:"POST",
          priceUsd:p.priceUsd,
          intents:p.intents,
          description:p.description,
          strategy:"observed-paid-gap",
        })),
        ...DEMAND_SNIPERS.map(item=>({resource:`${origin}${item.path}`,method:"POST",priceUsd:item.priceUsd,intents:item.intents,description:item.description})),
        ...revenueRoutes.filter((route:any)=>route.source==="demand"&&route.demand?.text).slice(0,50).map((route:any)=>({
          resource:`${origin}${route.path}`,
          method:"POST",
          priceUsd:route.priceUsd,
          intents:[route.demand.text,route.alias,route.title,route.id].filter(Boolean),
          description:`${route.title}: ${route.description} Demand signal: ${route.demand.text}`,
          demand:{count:route.demand.count,score:route.demand.score,signalType:route.demand.signalType,supplyMatches:route.demand.supplyMatches},
        })),
      ],
    },
    discovery:{
      spec:"x402-discovery/1",
      openapi:`${origin}/openapi.json`,
      router:{
        find:`${origin}/api/router/find`,
        quote:`${origin}/api/router/quote`,
        executePattern:`${origin}/api/router/execute/{tier}`,
        guidance:"Prefer exact paid-gap front doors when the task matches. FIND/QUOTE remain free for the long tail. Unmet-demand aliases refresh automatically.",
      },
    },
    mcp:{remoteConnector:`${origin}/api/mcp`,package:null},
  },{headers:{"cache-control":"public, max-age=60, s-maxage=300"}});
}
