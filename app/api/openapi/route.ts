import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const origin=(process.env.PENNYRAIL_PUBLIC_URL?.trim()||req.nextUrl.origin).replace(/\/$/,"");
  return NextResponse.json({
    openapi:"3.1.0",
    info:{title:"PennyRail",version:"0.3.0",description:"x402 pay-per-call utilities plus a dynamic micro-capability factory for autonomous agents."},
    servers:[{url:origin}],
    paths:{
      "/api/tools/json-canonicalize":{post:{operationId:"jsonCanonicalize",summary:"Canonicalize JSON deterministically",tags:["utility","json"],"x-price":"$0.001",requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:true}}}},responses:{"200":{description:"Canonical JSON result"},"402":{description:"x402 payment required"}}}},
      "/api/tools/text-stats":{get:{operationId:"textStats",summary:"Count text characters, words, sentences and reading time",tags:["utility","text"],"x-price":"$0.001",parameters:[{name:"text",in:"query",required:true,schema:{type:"string"}}],responses:{"200":{description:"Text statistics"},"402":{description:"x402 payment required"}}}},
      "/api/tools/strip-tracking":{get:{operationId:"stripTrackingParameters",summary:"Remove common tracking parameters from a URL",tags:["utility","url"],"x-price":"$0.001",parameters:[{name:"url",in:"query",required:true,schema:{type:"string",format:"uri"}}],responses:{"200":{description:"Cleaned URL"},"402":{description:"x402 payment required"}}}},
      "/api/factory/catalog":{get:{operationId:"factoryCatalog",summary:"Discover PennyRail Factory capabilities",description:"Free machine-readable capability catalog. Optionally pass q to match a natural-language need to an operation.",tags:["factory","discovery"],parameters:[{name:"q",in:"query",required:false,schema:{type:"string"}}],responses:{"200":{description:"Factory capability catalog or match"}}}},
      "/api/factory/run":{post:{operationId:"factoryRun",summary:"Run a PennyRail Factory micro-capability",description:"Execute one operation discovered from /api/factory/catalog. The factory currently serves 32 deterministic or fixed-upstream micro-capabilities behind one x402 endpoint.",tags:["factory","utility"],"x-price":"$0.003",requestBody:{required:true,content:{"application/json":{schema:{type:"object",required:["operation","input"],properties:{operation:{type:"string"},input:{}}}}}},responses:{"200":{description:"Operation result"},"400":{description:"Invalid operation or input"},"402":{description:"x402 payment required"}}}},
    }
  },{headers:{"cache-control":"public, max-age=60, s-maxage=300"}});
}
