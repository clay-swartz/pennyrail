import { NextRequest, NextResponse } from "next/server";
import { GAP_ARBITRAGE_PRODUCTS } from "@/lib/gap-arbitrage-catalog";

export const dynamic = "force-dynamic";

function origin(req:NextRequest){return (process.env.PENNYRAIL_PUBLIC_URL?.trim()||req.nextUrl.origin).replace(/\/$/,"");}

const PREVIOUS:Record<string,{summary:string,description:string,price:string,example:unknown}> = {
  "/api/agent/random":{summary:"Secure random",description:"Cryptographically secure random bytes/integers for AI agents.",price:"0.001",example:{min:1,max:100,count:3}},
  "/api/agent/uuid":{summary:"UUID v4/v7 generator",description:"Generate random or time-ordered UUIDs.",price:"0.001",example:{version:7,count:3}},
  "/api/agent/hash":{summary:"SHA-256 / SHA-512 hashing",description:"Hash text with SHA-256, SHA-512, SHA-1 or MD5.",price:"0.001",example:{text:"PennyRail",algorithm:"sha256"}},
  "/api/agent/base64-decode":{summary:"Base64 decode",description:"Decode Base64 to UTF-8.",price:"0.001",example:{input:"UGVubnlSYWls"}},
  "/api/agent/hex-decode":{summary:"Hex decode",description:"Decode hex to UTF-8.",price:"0.001",example:{input:"50656e6e795261696c"}},
  "/api/agent/token-count":{summary:"Exact LLM token count",description:"Count o200k_base or cl100k_base BPE tokens.",price:"0.001",example:{text:"PennyRail",encoding:"o200k_base"}},
  "/api/agent/time-convert":{summary:"Time / timezone conversion",description:"Convert epoch/ISO/timezone representations.",price:"0.001",example:{value:1767225600,timezone:"America/Chicago"}},
  "/api/agent/text-stats":{summary:"Text statistics",description:"Character, word and line counts.",price:"0.001",example:{input:"PennyRail stacks tiny paid calls."}},
  "/api/agent/dns":{summary:"DNS records",description:"Resolve A/AAAA/MX/TXT/CNAME/NS/CAA/SRV records.",price:"0.001",example:{domain:"example.com",type:"A"}},
  "/api/agent/block-number":{summary:"Latest EVM block",description:"Latest Base/Ethereum/Polygon/Arbitrum/Optimism block number.",price:"0.001",example:{network:"base"}},
  "/api/agent/weather":{summary:"Current weather",description:"Current global weather by city or coordinates.",price:"0.001",example:{city:"Dallas"}},
  "/api/agent/fx-convert":{summary:"Currency conversion / FX",description:"Current ECB-backed currency conversion.",price:"0.001",example:{amount:100,from:"USD",to:"EUR"}},
  "/api/agent/page-metadata":{summary:"Page/article metadata",description:"Title, description, canonical, favicon, OpenGraph and Twitter metadata.",price:"0.001",example:{url:"https://example.com"}},
  "/api/agent/chat-mini":{summary:"GPT-4o-mini chat inference",description:"Low-cost OpenAI-compatible bounded chat completion.",price:"0.009",example:{messages:[{role:"user",content:"Reply with OK."}],max_tokens:16}},
  "/api/agent/web-search":{summary:"Live web search + sources",description:"Current web search, latest news and research with source URLs/titles.",price:"0.018",example:{query:"latest x402 agent commerce news",count:5,freshness:"pw"}},
};

function paid(summary:string,description:string,price:string,example:unknown){
  return {post:{summary,description,"x-price":`$${price}`,"x-payment-info":{price:{mode:"fixed",currency:"USD",amount:price},protocols:[{x402:{}}]},requestBody:{required:false,content:{"application/json":{schema:{type:"object",additionalProperties:true},example}}},responses:{"200":{description:"Successful paid PennyRail result"},"402":{description:"Payment Required — x402 USDC on Base"}}}};
}

export async function GET(req:NextRequest){
  const paths:Record<string,any>={};
  for(const [path,p] of Object.entries(PREVIOUS)) paths[path]=paid(p.summary,p.description,p.price,p.example);
  for(const p of GAP_ARBITRAGE_PRODUCTS) paths[p.path]=paid(p.title,p.description,String(p.priceUsd),p.sampleInput);
  return NextResponse.json({
    openapi:"3.1.0",
    info:{
      title:"PennyRail — autonomous x402 paid-gap arbitrage",
      version:"0.42.0",
      description:"PennyRail watches real paid agent demand and unmet requests, then exposes cheaper exact-match x402 services. High-frequency deterministic calls start at $0.001; public-data/browser/data services undercut observed competing prices where sustainable."
    },
    servers:[{url:origin(req)}],
    paths,
  },{headers:{"cache-control":"public, max-age=60, s-maxage=300"}});
}
