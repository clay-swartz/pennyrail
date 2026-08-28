import { NextRequest, NextResponse } from "next/server";
import { FACTORY_CAPABILITIES } from "@/lib/factory";

export const dynamic = "force-dynamic";

function opId(id:string){ return `penny_${id.replace(/[^a-zA-Z0-9]+/g,"_")}`; }

export async function GET(req: NextRequest) {
  const origin=(process.env.PENNYRAIL_PUBLIC_URL?.trim()||req.nextUrl.origin).replace(/\/$/,"");
  const factoryPaths=Object.fromEntries(FACTORY_CAPABILITIES.map(c => [
    `/api/f/${c.id}`,
    { post:{ operationId:opId(c.id), summary:c.title, description:c.description, tags:["pennyrail","factory",c.id.split(".")[0]], "x-price":"$0.001", requestBody:{required:true,content:{"application/json":{schema:{type:"object",description:`Body may be {input: ...} or the input directly. Expected: ${c.inputHint}`}}}}, responses:{"200":{description:"Utility result"},"400":{description:"Invalid input"},"402":{description:"x402 payment required"}} } }
  ]));
  return NextResponse.json({
    openapi:"3.1.0",
    info:{title:"PennyRail",version:"0.4.0",description:`${FACTORY_CAPABILITIES.length + 3} tiny x402 pay-per-call machine utilities.`},
    servers:[{url:origin}],
    paths:{
      "/api/tools/json-canonicalize":{post:{operationId:"jsonCanonicalize",summary:"Canonicalize JSON deterministically",tags:["utility","json"],"x-price":"$0.001",requestBody:{required:true,content:{"application/json":{schema:{type:"object",additionalProperties:true}}}},responses:{"200":{description:"Canonical JSON result"},"402":{description:"x402 payment required"}}}},
      "/api/tools/text-stats":{get:{operationId:"textStats",summary:"Count text characters, words, sentences and reading time",tags:["utility","text"],"x-price":"$0.001",parameters:[{name:"text",in:"query",required:true,schema:{type:"string"}}],responses:{"200":{description:"Text statistics"},"402":{description:"x402 payment required"}}}},
      "/api/tools/strip-tracking":{get:{operationId:"stripTrackingParameters",summary:"Remove common tracking parameters from a URL",tags:["utility","url"],"x-price":"$0.001",parameters:[{name:"url",in:"query",required:true,schema:{type:"string",format:"uri"}}],responses:{"200":{description:"Cleaned URL"},"402":{description:"x402 payment required"}}}},
      ...factoryPaths,
      "/api/factory/catalog":{get:{operationId:"factoryCatalog",summary:"Discover PennyRail capabilities",tags:["factory","discovery"],parameters:[{name:"q",in:"query",required:false,schema:{type:"string"}}],responses:{"200":{description:"Capability catalog or natural-language match"}}}},
    }
  },{headers:{"cache-control":"public, max-age=60, s-maxage=300"}});
}
