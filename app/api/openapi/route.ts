import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({openapi:'3.1.0',info:{title:'PennyRail PennyTools',version:'0.1.0'},paths:{
'/api/tools/json-canonicalize':{post:{summary:'Canonicalize JSON',description:'Recursively sort JSON object keys. x402 paid.',requestBody:{required:true},responses:{'200':{description:'Canonical JSON'}}}},
'/api/tools/text-stats':{get:{summary:'Text statistics',parameters:[{name:'text',in:'query',required:true,schema:{type:'string'}}],responses:{'200':{description:'Counts'}}}},
'/api/tools/strip-tracking':{get:{summary:'Strip URL tracking parameters',parameters:[{name:'url',in:'query',required:true,schema:{type:'string'}}],responses:{'200':{description:'Clean URL'}}}}
}})}
