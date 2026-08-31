import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";
type AnyObj = Record<string, any>;

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function finite(value: unknown, name: string) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a finite number`);
  return n;
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function assertPublicUrl(raw: unknown) {
  const value = text(raw).trim();
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("url must be a valid absolute URL"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("url must use http or https");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) throw new Error("private/local targets are not allowed");
  return url;
}

async function fetchText(url: string, init?: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    const body = await response.text();
    if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}`);
    return { body, status: response.status, headers: response.headers };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12000) {
  const { body, status, headers } = await fetchText(url, init, timeoutMs);
  try { return { body: body ? JSON.parse(body) : null, status, headers }; }
  catch { throw new Error("upstream returned invalid JSON"); }
}

export async function runBrowserReader(input: any, mode: "render" | "extract") {
  const target = assertPublicUrl(input?.url ?? input);
  const maxChars = clampInt(input?.maxChars, 1000, 250000, 100000);
  const endpoint = `https://r.jina.ai/${target.toString()}`;
  const headers: Record<string,string> = {
    accept: "text/markdown,text/plain;q=0.9,*/*;q=0.5",
    "user-agent": "PennyRail/1.0 (+https://pennyrail.vercel.app)",
  };
  const jinaKey = process.env.JINA_API_KEY?.trim();
  if (jinaKey) headers.authorization = `Bearer ${jinaKey}`;
  const { body } = await fetchText(endpoint, { headers }, 30000);
  const truncated = body.length > maxChars;
  return {
    url: target.toString(),
    mode,
    format: "markdown",
    content: truncated ? body.slice(0, maxChars) : body,
    charactersReturned: Math.min(body.length, maxChars),
    truncated,
    source: "Jina Reader hosted API",
    browserBacked: true,
    authenticatedUpstream: Boolean(jinaKey),
  };
}

function privateIpv4(ip:string) {
  const parts=ip.split(".").map(Number);
  if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255)) return true;
  const [a,b]=parts;
  return a===10 || a===127 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&b===168) || a===0 || a>=224;
}

function privateIpv6(ip:string) {
  const v=ip.toLowerCase();
  return v==="::1" || v==="::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

async function assertResolvedPublic(url:URL) {
  const host=url.hostname;
  const literal=isIP(host);
  if(literal===4 && privateIpv4(host)) throw new Error("private/local target is not allowed");
  if(literal===6 && privateIpv6(host)) throw new Error("private/local target is not allowed");
  if(literal) return;
  const [v4,v6]=await Promise.all([
    resolve4(host).catch(()=>[] as string[]),
    resolve6(host).catch(()=>[] as string[]),
  ]);
  const ips=[...v4,...v6];
  if(!ips.length) throw new Error("target hostname did not resolve");
  for(const ip of ips) {
    if(isIP(ip)===4 && privateIpv4(ip)) throw new Error("target resolved to a private/local IPv4 address");
    if(isIP(ip)===6 && privateIpv6(ip)) throw new Error("target resolved to a private/local IPv6 address");
  }
}

function headerObject(headers:Headers) {
  const out:Record<string,string>={};
  headers.forEach((value,key)=>{out[key]=value;});
  return out;
}

function safeJson(textBody:string) {
  try { return textBody ? JSON.parse(textBody) : null; } catch { return null; }
}

function collectPaymentHints(body:any, headers:Record<string,string>) {
  const accepts=Array.isArray(body?.accepts) ? body.accepts : Array.isArray(body?.payment?.accepts) ? body.payment.accepts : [];
  const rows=accepts.slice(0,20).map((row:any)=>({
    scheme:row?.scheme??null,
    network:row?.network??row?.chainId??null,
    asset:row?.asset??row?.currency??null,
    amount:row?.maxAmountRequired??row?.amount??row?.price??null,
    payTo:row?.payTo??row?.recipient??null,
    description:row?.description??null,
  }));
  return {
    accepts:rows,
    paymentRequiredHeader:headers["x-payment-required"]||headers["payment-required"]||null,
    paymentResponseHeader:headers["x-payment-response"]||headers["payment-response"]||null,
  };
}

export async function runX402Quote(input:any) {
  const target=assertPublicUrl(input?.url);
  await assertResolvedPublic(target);
  const method=text(input?.method||"GET").trim().toUpperCase();
  if(!["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(method)) throw new Error("unsupported HTTP method");
  const headers:Record<string,string>={accept:"application/json,text/plain;q=0.9,*/*;q=0.5","user-agent":"PennyRail/1.0 (+https://pennyrail.vercel.app)"};
  let bodyInit:string|undefined;
  if(input?.body!==undefined && !["GET","HEAD"].includes(method)) {
    headers["content-type"]="application/json";
    bodyInit=JSON.stringify(input.body);
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(target,{method,headers,body:bodyInit,redirect:"manual",cache:"no-store",signal:controller.signal});
    const raw=(await response.text()).slice(0,50000);
    const parsed=safeJson(raw);
    const responseHeaders=headerObject(response.headers);
    return {
      url:target.toString(),
      method,
      status:response.status,
      paymentRequired:response.status===402,
      location:responseHeaders.location||null,
      challenge:collectPaymentHints(parsed,responseHeaders),
      body:parsed??(raw||null),
      note:"Read-only probe. PennyRail did not pay the target endpoint.",
    };
  } finally { clearTimeout(timer); }
}

export async function runHackerNews(input: any) {
  const query = text(input?.query ?? input?.q ?? "").trim();
  const sort = text(input?.sort ?? "recent").toLowerCase();
  const limit = clampInt(input?.limit, 1, 50, 10);
  const tags = text(input?.tags ?? "story").trim();
  const endpoint = sort === "popular" ? "search" : "search_by_date";
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (tags) params.set("tags", tags);
  params.set("hitsPerPage", String(limit));
  const { body } = await fetchJson(`https://hn.algolia.com/api/v1/${endpoint}?${params}`, {
    headers: { accept: "application/json", "user-agent": "PennyRail/1.0 (+https://pennyrail.vercel.app)" },
  });
  const hits = Array.isArray(body?.hits) ? body.hits : [];
  return {
    query,
    sort,
    count: hits.length,
    totalHits: Number.isFinite(body?.nbHits) ? body.nbHits : null,
    results: hits.map((row:any) => ({
      id: row.objectID || null,
      title: row.title || row.story_title || null,
      url: row.url || row.story_url || (row.objectID ? `https://news.ycombinator.com/item?id=${row.objectID}` : null),
      author: row.author || null,
      points: Number.isFinite(row.points) ? row.points : null,
      comments: Number.isFinite(row.num_comments) ? row.num_comments : null,
      createdAt: row.created_at || null,
      text: typeof row.story_text === "string" ? row.story_text.slice(0, 4000) : (typeof row.comment_text === "string" ? row.comment_text.slice(0, 4000) : null),
    })),
    source: "HN Search powered by Algolia",
  };
}

function actualType(value:any) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  return typeof value;
}

function typeMatches(value: any, typeRule: any): boolean {
  if (Array.isArray(typeRule)) {
    return typeRule.some((t: any): boolean => typeMatches(value, t));
  }
  if (!typeRule) return true;
  const t = actualType(value);
  if (typeRule === "number") return t === "number" || t === "integer";
  return t === typeRule;
}

export type ValidationError = { path:string; rule:string; message:string };

export function validateJsonSchema(value:any, schema:any, path = "$"): ValidationError[] {
  if (!schema || typeof schema !== "object") return [];
  if (typeof schema.$ref === "string") return [{ path, rule:"$ref", message:"$ref is present but not dereferenced by this deterministic validator" }];
  const errors: ValidationError[] = [];
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push({ path, rule:"type", message:`expected ${Array.isArray(schema.type)?schema.type.join("|"):schema.type}, got ${actualType(value)}` });
    return errors;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((v:any)=>JSON.stringify(v)===JSON.stringify(value))) {
    errors.push({ path, rule:"enum", message:"value is not one of the allowed enum values" });
  }
  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((s:any,i:number)=>errors.push(...validateJsonSchema(value,s,`${path}.allOf[${i}]`)));
  }
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((s:any)=>validateJsonSchema(value,s,path).length===0)) {
    errors.push({ path, rule:"anyOf", message:"value did not satisfy any schema in anyOf" });
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((s:any)=>validateJsonSchema(value,s,path).length===0).length;
    if (matches !== 1) errors.push({ path, rule:"oneOf", message:`value satisfied ${matches} oneOf schemas; expected exactly 1` });
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as AnyObj;
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) if (!Object.prototype.hasOwnProperty.call(obj,key)) {
      errors.push({ path:`${path}.${key}`, rule:"required", message:"required property is missing" });
    }
    const props = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    for (const [key, sub] of Object.entries(props)) {
      if (Object.prototype.hasOwnProperty.call(obj,key)) errors.push(...validateJsonSchema(obj[key],sub,`${path}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) if (!Object.prototype.hasOwnProperty.call(props,key)) {
        errors.push({ path:`${path}.${key}`, rule:"additionalProperties", message:"additional property is not allowed" });
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item,i)=>errors.push(...validateJsonSchema(item,schema.items,`${path}[${i}]`)));
  }
  return errors;
}

export function inferSchema(value:any): any {
  const t = actualType(value);
  if (t === "null") return { type:"null" };
  if (t === "array") {
    const arr = value as any[];
    if (!arr.length) return { type:"array", items:{} };
    const schemas = arr.map(inferSchema);
    const unique = [...new Map(schemas.map(s=>[JSON.stringify(s),s])).values()];
    return { type:"array", items: unique.length===1 ? unique[0] : { anyOf: unique.slice(0,8) } };
  }
  if (t === "object") {
    const props: AnyObj = {};
    for (const [k,v] of Object.entries(value)) props[k]=inferSchema(v);
    return { type:"object", required:Object.keys(value), properties:props };
  }
  return { type:t };
}

function collectShape(schema:any, prefix="$", out:Record<string,string>={}) {
  if (!schema || typeof schema !== "object") return out;
  if (schema.type) out[prefix] = Array.isArray(schema.type) ? schema.type.join("|") : String(schema.type);
  if (schema.properties && typeof schema.properties === "object") {
    for (const [k,v] of Object.entries(schema.properties)) collectShape(v,`${prefix}.${k}`,out);
  }
  if (schema.items) collectShape(schema.items,`${prefix}[]`,out);
  return out;
}

export function runSchemaGuard(input:any) {
  const schema = input?.schema;
  const payload = input?.payload ?? input?.value;
  if (!schema || typeof schema !== "object") throw new Error("schema object is required");
  const errors = validateJsonSchema(payload,schema);
  const inferredSchema = inferSchema(payload);
  const expected = collectShape(schema);
  const actual = collectShape(inferredSchema);
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  const missingInPayload = expectedKeys.filter(k=>!(k in actual));
  const unexpectedInPayload = actualKeys.filter(k=>!(k in expected));
  const typeMismatches = expectedKeys
    .filter(k=>k in actual && expected[k]!==actual[k] && !(expected[k]==="number" && actual[k]==="integer"))
    .map(k=>({path:k,expected:expected[k],actual:actual[k]}));
  return {
    valid: errors.length===0,
    errors,
    inferredSchema,
    drift: { missingInPayload, unexpectedInPayload, typeMismatches },
    normalized: JSON.parse(JSON.stringify(payload)),
  };
}

function resolveOperation(spec:any, path:string, method:string) {
  const op = spec?.paths?.[path]?.[method.toLowerCase()];
  if (!op) throw new Error("operation not found at method + path");
  return op;
}

function firstJsonSchema(content:any) {
  if (!content || typeof content !== "object") return null;
  const entries = Object.values(content) as any[];
  return content["application/json"]?.schema
    || content["application/*+json"]?.schema
    || entries.find((v:any)=>v?.schema)?.schema
    || null;
}

export function runOpenApiValidate(input:any) {
  const spec = input?.spec;
  const path = text(input?.path).trim();
  const method = text(input?.method || "get").trim().toLowerCase();
  const part = text(input?.part || "request").trim().toLowerCase();
  const payload = input?.payload;
  if (!spec || typeof spec !== "object") throw new Error("spec object is required");
  if (!path) throw new Error("path is required");
  const op = resolveOperation(spec,path,method);
  let schema:any = null;
  let status:string|null = null;
  if (part === "request") {
    schema = firstJsonSchema(op?.requestBody?.content);
  } else if (part === "response") {
    const responses = op?.responses || {};
    status = text(input?.status).trim();
    if (!status) status = Object.keys(responses).find(k=>/^2\d\d$/.test(k)) || Object.keys(responses)[0] || "";
    schema = firstJsonSchema(responses?.[status]?.content);
  } else throw new Error("part must be request or response");
  if (!schema) return { valid:true, schemaPresent:false, errors:[], part, status, path, method };
  const errors = validateJsonSchema(payload,schema);
  return { valid:errors.length===0, schemaPresent:true, errors, part, status, path, method };
}

function parseJsonPath(path:string) {
  const tokens:(string|number)[] = [];
  const re = /([^[.\]]+)|\[(\d+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\]/g;
  let match:RegExpExecArray|null;
  while ((match = re.exec(path))) {
    if (match[1] != null) tokens.push(match[1]);
    else {
      const raw = match[2];
      if (/^\d+$/.test(raw)) tokens.push(Number(raw));
      else tokens.push(JSON.parse(raw[0]==="'" ? `"${raw.slice(1,-1).replace(/"/g,'\\"')}"` : raw));
    }
  }
  return tokens;
}

export function runJsonQuery(input:any) {
  const value = input?.value ?? input?.json;
  const path = text(input?.path).trim();
  if (!path) throw new Error("path is required");
  const tokens = parseJsonPath(path);
  let current:any = value;
  for (const token of tokens) {
    if (current == null || !Object.prototype.hasOwnProperty.call(Object(current),token as any)) {
      return { found:false, value:null, path, tokens };
    }
    current = current[token as any];
  }
  return { found:true, value:current, path, tokens };
}

function rgbToHsl(r:number,g:number,b:number) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  if (max!==min) {
    const d=max-min;
    s=l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}
    h/=6;
  }
  return { h:Math.round(h*360), s:Math.round(s*10000)/100, l:Math.round(l*10000)/100 };
}

function hslToRgb(h:number,s:number,l:number) {
  h=((h%360)+360)%360/360; s/=100; l/=100;
  if (s===0) { const v=Math.round(l*255); return {r:v,g:v,b:v}; }
  const hue2rgb=(p:number,q:number,t:number)=>{if(t<0)t+=1;if(t>1)t-=1;if(t<1/6)return p+(q-p)*6*t;if(t<1/2)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};
  const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
  return {r:Math.round(hue2rgb(p,q,h+1/3)*255),g:Math.round(hue2rgb(p,q,h)*255),b:Math.round(hue2rgb(p,q,h-1/3)*255)};
}

function parseColor(input:any) {
  if (input && typeof input==="object" && [input.r,input.g,input.b].every(Number.isFinite)) {
    return {r:Math.round(input.r),g:Math.round(input.g),b:Math.round(input.b)};
  }
  const value=text(input?.value??input).trim();
  let m=value.match(/^#([0-9a-f]{6})$/i);
  if(m) return {r:parseInt(m[1].slice(0,2),16),g:parseInt(m[1].slice(2,4),16),b:parseInt(m[1].slice(4,6),16)};
  m=value.match(/^#([0-9a-f]{3})$/i);
  if(m) return {r:parseInt(m[1][0]+m[1][0],16),g:parseInt(m[1][1]+m[1][1],16),b:parseInt(m[1][2]+m[1][2],16)};
  m=value.match(/^rgb\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)$/i);
  if(m) return {r:Number(m[1]),g:Number(m[2]),b:Number(m[3])};
  m=value.match(/^hsl\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)$/i);
  if(m) return hslToRgb(Number(m[1]),Number(m[2]),Number(m[3]));
  throw new Error("color must be #RGB, #RRGGBB, rgb(r,g,b), hsl(h,s%,l%) or {r,g,b}");
}

export function runColorConvert(input:any) {
  const rgb=parseColor(input);
  for (const k of ["r","g","b"] as const) if (!Number.isFinite(rgb[k]) || rgb[k]<0 || rgb[k]>255) throw new Error("RGB channels must be between 0 and 255");
  const r=Math.round(rgb.r),g=Math.round(rgb.g),b=Math.round(rgb.b);
  const hex=`#${[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
  const hsl=rgbToHsl(r,g,b);
  return {hex,rgb:{r,g,b},hsl,css:{rgb:`rgb(${r}, ${g}, ${b})`,hsl:`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`}};
}

function mean(values:number[]) { return values.reduce((a,b)=>a+b,0)/values.length; }
function std(values:number[]) {
  if (values.length<2) return 0;
  const m=mean(values);
  return Math.sqrt(values.reduce((s,v)=>s+(v-m)**2,0)/(values.length-1));
}

export function runForecastNaive(input:any) {
  const raw=Array.isArray(input)?input:(input?.values??input?.history);
  if(!Array.isArray(raw)||raw.length<2) throw new Error("values/history must contain at least 2 numbers");
  const values=raw.map((v:any)=>finite(v,"value"));
  const horizon=clampInt(input?.horizon,1,100,1);
  const avg=mean(values), last=values[values.length-1], first=values[0];
  const driftStep=(last-first)/(values.length-1);
  const diffs=values.slice(1).map((v,i)=>v-values[i]);
  const sigma=Math.max(std(diffs),1e-12);
  const build=(method:string, points:number[])=>({
    method,
    points: points.map((point,i)=>{
      const width=1.96*sigma*Math.sqrt(i+1);
      return {step:i+1,forecast:point,lower95:point-width,upper95:point+width};
    })
  });
  return {
    historyCount:values.length,
    horizon,
    forecasts:[
      build("mean",Array.from({length:horizon},()=>avg)),
      build("naive",Array.from({length:horizon},()=>last)),
      build("drift",Array.from({length:horizon},(_,i)=>last+driftStep*(i+1))),
    ],
    note:"Intervals are simple innovation-based 95% baselines; use as a sanity floor rather than a calibrated production model.",
  };
}

export async function runGapArbitragePrimitive(id:string,input:any) {
  switch(id) {
    case "browser.render": return runBrowserReader(input,"render");
    case "web.extract": return runBrowserReader(input,"extract");
    case "x402.quote": return runX402Quote(input);
    case "data.hacker-news": return runHackerNews(input);
    case "json.schema-guard": return runSchemaGuard(input);
    case "openapi.validate-payload": return runOpenApiValidate(input);
    case "json.query": return runJsonQuery(input);
    case "color.convert": return runColorConvert(input);
    case "forecast.naive": return runForecastNaive(input);
    default: throw new Error("unknown gap-arbitrage primitive");
  }
}
