import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
function origin(req: NextRequest) {
  return (process.env.PENNYRAIL_PUBLIC_URL?.trim() || req.nextUrl.origin).replace(/\/$/, "");
}
const paid = (summary:string, description:string, price:string, example:unknown) => ({
  post:{
    summary,description,
    "x-price":`$${price}`,
    "x-payment-info":{price:{mode:"fixed",currency:"USD",amount:price},protocols:[{x402:{}}]},
    requestBody:{required:false,content:{"application/json":{schema:{type:"object",additionalProperties:true},example}}},
    responses:{"200":{description:"Successful paid PennyRail result"},"402":{description:"Payment Required — x402 USDC on Base"}}
  }
});
export async function GET(req:NextRequest){
  return NextResponse.json({
    openapi:"3.1.0",
    info:{
      title:"PennyRail — autonomous x402 demand sniper",
      version:"0.41.0",
      description:"PennyRail watches what AI agents pay for and fail to find, auto-publishes matching capabilities, and price-snipes high-frequency machine work. Exact-match tools start at the $0.001 active facilitator floor on Base; free FIND and QUOTE cover the long tail."
    },
    servers:[{url:origin(req)}],
    paths:{
      "/api/agent/random":paid("Secure random","Cryptographically secure random bytes/integers for AI agents.","0.001",{min:1,max:100,count:3}),
      "/api/agent/uuid":paid("UUID v4/v7 generator","Generate random or time-ordered UUIDs.","0.001",{version:7,count:3}),
      "/api/agent/hash":paid("SHA-256 / SHA-512 hashing","Hash text with SHA-256, SHA-512, SHA-1 or MD5.","0.001",{text:"PennyRail",algorithm:"sha256"}),
      "/api/agent/base64-decode":paid("Base64 decode","Decode Base64 to UTF-8.","0.001",{input:"UGVubnlSYWls"}),
      "/api/agent/hex-decode":paid("Hex decode","Decode hex to UTF-8.","0.001",{input:"50656e6e795261696c"}),
      "/api/agent/token-count":paid("Exact LLM token count","Count o200k_base or cl100k_base BPE tokens.","0.001",{text:"PennyRail",encoding:"o200k_base"}),
      "/api/agent/time-convert":paid("Time / timezone conversion","Convert epoch/ISO/timezone representations.","0.001",{value:1767225600,timezone:"America/Chicago"}),
      "/api/agent/text-stats":paid("Text statistics","Character, word and line counts.","0.001",{input:"PennyRail stacks tiny paid calls."}),
      "/api/agent/dns":paid("DNS records","Resolve A/AAAA/MX/TXT/CNAME/NS/CAA/SRV records.","0.001",{domain:"example.com",type:"A"}),
      "/api/agent/block-number":paid("Latest EVM block","Latest Base/Ethereum/Polygon/Arbitrum/Optimism block number.","0.001",{network:"base"}),
      "/api/agent/weather":paid("Current weather","Current global weather by city or coordinates.","0.001",{city:"Dallas"}),
      "/api/agent/fx-convert":paid("Currency conversion / FX","Current ECB-backed currency conversion.","0.001",{amount:100,from:"USD",to:"EUR"}),
      "/api/agent/page-metadata":paid("Page/article metadata","Title, description, canonical, favicon, OpenGraph and Twitter metadata.","0.001",{url:"https://example.com"}),
      "/api/agent/chat-mini":paid("GPT-4o-mini chat inference","Low-cost OpenAI-compatible bounded chat completion.","0.009",{messages:[{role:"user",content:"Reply with OK."}],max_tokens:16}),
      "/api/agent/web-search":paid("Live web search + sources","Current web search, latest news and research with source URLs/titles.","0.018",{query:"latest x402 agent commerce news",count:5,freshness:"pw"})
    }
  },{headers:{"cache-control":"public, max-age=60, s-maxage=300"}});
}
