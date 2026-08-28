import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { runFactoryOperation } from "@/lib/factory";

export type ProvenProduct = {
  id: string;
  title: string;
  description: string;
  aliases: string[];
  tier: "nano" | "network" | "micro" | "standard";
  inputHint: string;
  sampleInput: unknown;
  source: "template";
  template: string;
};

export const PROVEN_PRODUCTS: ProvenProduct[] = [
  {
    id: "utility.random-secure",
    title: "Secure random",
    description: "Cryptographically secure random bytes or unbiased integers, with bounded batch generation.",
    aliases: ["random", "secure random", "random bytes", "random integer", "cryptographic randomness"],
    tier: "nano",
    inputHint: "{bytes?:1..1024,min?:integer,max?:integer,count?:1..100}",
    sampleInput: { min: 1, max: 100, count: 3 },
    source: "template",
    template: "secure-random",
  },
  {
    id: "utility.uuid-generate",
    title: "UUID generator",
    description: "Generate UUID v4 or time-ordered UUID v7 values, one or many per call.",
    aliases: ["uuid", "uuid generator", "uuid v4", "uuid v7", "generate uuid"],
    tier: "nano",
    inputHint: "{version?:4|7,count?:1..100}",
    sampleInput: { version: 7, count: 3 },
    source: "template",
    template: "uuid-generate",
  },
  {
    id: "crypto.hash-multi",
    title: "Multi-algorithm hash",
    description: "Hash text with SHA-256, SHA-512, SHA-1 or MD5 and return hex plus base64 digests.",
    aliases: ["hash", "cryptographic hash", "sha512", "sha1", "md5", "sha256 hash"],
    tier: "nano",
    inputHint: "{text,algorithm?:sha256|sha512|sha1|md5}",
    sampleInput: { text: "PennyRail", algorithm: "sha512" },
    source: "template",
    template: "hash-multi",
  },
  {
    id: "mime.lookup",
    title: "MIME lookup",
    description: "Look up a MIME type by common file extension or common extensions by MIME type.",
    aliases: ["mime", "mime type lookup", "file extension mime", "mime extensions"],
    tier: "nano",
    inputHint: "{ext?:string,type?:string}",
    sampleInput: { ext: "png" },
    source: "template",
    template: "mime-lookup",
  },
  {
    id: "time.convert-any",
    title: "Time convert",
    description: "Convert epoch seconds/milliseconds or ISO timestamps into ISO, Unix and IANA-timezone representations.",
    aliases: ["time convert", "epoch to iso", "iso to epoch", "timezone convert", "unix timestamp convert"],
    tier: "nano",
    inputHint: "{value,timezone?:IANA timezone}",
    sampleInput: { value: 1767225600, timezone: "America/Chicago" },
    source: "template",
    template: "time-convert",
  },
  {
    id: "encoding.base32",
    title: "Base32 encode/decode",
    description: "RFC 4648 Base32 encode or decode UTF-8 text.",
    aliases: ["base32", "base32 encode", "base32 decode"],
    tier: "nano",
    inputHint: "{mode:encode|decode,value:string}",
    sampleInput: { mode: "encode", value: "PennyRail" },
    source: "template",
    template: "base32",
  },
  {
    id: "encoding.base58",
    title: "Base58 encode/decode",
    description: "Bitcoin-alphabet Base58 encode or decode UTF-8 text.",
    aliases: ["base58", "base58 encode", "base58 decode"],
    tier: "nano",
    inputHint: "{mode:encode|decode,value:string}",
    sampleInput: { mode: "encode", value: "PennyRail" },
    source: "template",
    template: "base58",
  },
  {
    id: "text.html-entities",
    title: "HTML entities",
    description: "Encode HTML-sensitive characters or decode common named and numeric HTML entities.",
    aliases: ["html entities", "html entity encode", "html entity decode", "escape html"],
    tier: "nano",
    inputHint: "{mode:encode|decode,value:string}",
    sampleInput: { mode: "encode", value: "Tom & <Jerry>" },
    source: "template",
    template: "html-entities",
  },
  {
    id: "text.rot13",
    title: "ROT13",
    description: "Apply the reversible ROT13 substitution to ASCII letters.",
    aliases: ["rot13", "rot 13", "rot13 encode", "rot13 decode"],
    tier: "nano",
    inputHint: "string or {value:string}",
    sampleInput: "PennyRail",
    source: "template",
    template: "rot13",
  },
  {
    id: "number.roman",
    title: "Roman numerals",
    description: "Convert integers 1-3999 to Roman numerals or parse canonical Roman numerals back to integers.",
    aliases: ["roman", "roman numerals", "integer to roman", "roman to integer"],
    tier: "nano",
    inputHint: "integer 1..3999 or Roman numeral string",
    sampleInput: 2026,
    source: "template",
    template: "roman",
  },
  {
    id: "text.lorem",
    title: "Lorem ipsum",
    description: "Generate bounded deterministic lorem ipsum placeholder text.",
    aliases: ["lorem", "lorem ipsum", "placeholder text", "dummy text"],
    tier: "nano",
    inputHint: "{paragraphs?:1..10}",
    sampleInput: { paragraphs: 2 },
    source: "template",
    template: "lorem",
  },
  {
    id: "text.stats",
    title: "Text stats",
    description: "Return character, byte, word, line and non-empty-line counts for text.",
    aliases: ["text stats", "word count", "character count", "line count", "text metrics"],
    tier: "nano",
    inputHint: "string or {text:string}",
    sampleInput: "PennyRail stacks tiny paid calls.",
    source: "template",
    template: "text-stats",
  },
  {
    id: "chain.block-number",
    title: "Latest EVM block number",
    description: "Read the latest block number from fixed public RPC endpoints for Base, Ethereum, Polygon, Arbitrum or Optimism.",
    aliases: ["block number", "latest block", "latest block number", "current block height", "evm block number"],
    tier: "nano",
    inputHint: "{network?:base|ethereum|polygon|arbitrum|optimism}",
    sampleInput: { network: "base" },
    source: "template",
    template: "block-number",
  },
  {
    id: "chain.info",
    title: "EVM chain info",
    description: "Return deterministic chain ID, native asset, explorer and public RPC metadata for major EVM networks.",
    aliases: ["chain info", "evm chain info", "chain id lookup", "network metadata"],
    tier: "nano",
    inputHint: "network name or chain id",
    sampleInput: "base",
    source: "template",
    template: "chain-info",
  },
  {
    id: "evm.address-label",
    title: "Known EVM address label",
    description: "Label a curated set of major token contracts, DEX routers, system and burn addresses; unknown addresses return found:false.",
    aliases: ["address label", "evm address label", "known address lookup", "contract address label"],
    tier: "nano",
    inputHint: "{address,network?:ethereum|base}",
    sampleInput: { address: "0x833589fCD6eDb6E08f4c7c32D4f71b54bdA02913", network: "base" },
    source: "template",
    template: "address-label",
  },
  {
    id: "weather.current",
    title: "Current weather",
    description: "Current weather from Open-Meteo by city name or latitude/longitude, including temperature, wind and weather code.",
    aliases: ["weather current", "current weather", "weather now", "weather by city"],
    tier: "network",
    inputHint: "{city?,latitude?,longitude?}",
    sampleInput: { city: "Dallas" },
    source: "template",
    template: "weather-current",
  },
  {
    id: "market.x402-trending",
    title: "x402 seller momentum",
    description: "Rank currently payment-ready x402 services by measured buyers, transactions, volume or recent trend using x402 List traction data.",
    aliases: ["x402 trending", "x402 sellers trending", "x402 momentum", "top x402 sellers", "x402 market radar"],
    tier: "micro",
    inputHint: "{sort?:buyers|transactions|volume|trend,limit?:1..50}",
    sampleInput: { sort: "buyers", limit: 10 },
    source: "template",
    template: "x402-trending",
  },
  {
    id: "locale.brief",
    title: "Locale brief",
    description: "Country facts, current local time, public holidays and working days remaining this week in one call.",
    aliases: ["locale brief", "country holiday brief", "working days remaining", "counterparty locale", "country time holidays"],
    tier: "standard",
    inputHint: "{countryCode:2-letter ISO}",
    sampleInput: { countryCode: "DE" },
    source: "template",
    template: "locale-brief",
  },
  {
    id: "openapi.search",
    title: "OpenAPI operation search",
    description: "Search an OpenAPI document for operations that best match a natural-language query.",
    aliases: ["openapi search", "search openapi", "find openapi operation", "openapi endpoint search"],
    tier: "nano",
    inputHint: "{spec:object,query:string,limit?:1..20}",
    sampleInput: { spec: { openapi: "3.1.0", paths: { "/users": { get: { summary: "List users" } } } }, query: "list users" },
    source: "template",
    template: "openapi-search",
  },
  {
    id: "openapi.mock-response",
    title: "OpenAPI mock response",
    description: "Generate a deterministic example response from an OpenAPI response schema, example, default or enum.",
    aliases: ["openapi mock response", "mock openapi response", "openapi sample response", "schema mock"],
    tier: "nano",
    inputHint: "{spec:object,path:string,method:string,status?:string}",
    sampleInput: { spec: { openapi: "3.1.0", paths: { "/ping": { get: { responses: { "200": { content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" } } } } } } } } } } }, path: "/ping", method: "get" },
    source: "template",
    template: "openapi-mock",
  },
  {
    id: "jwt.toolkit",
    title: "JWT toolkit",
    description: "Decode JWT header/claims, normalize time claims and optionally verify HMAC JWTs (HS256/384/512) with constant-time comparison.",
    aliases: ["jwt toolkit", "jwt decode", "jwt inspect", "jwt verify hmac", "token claims"],
    tier: "standard",
    inputHint: "{token,secret?}",
    sampleInput: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.invalid" },
    source: "template",
    template: "jwt-toolkit",
  },
];

export const BESTSELLER_PRODUCT_MAP: Record<string, string> = {
  random: "utility.random-secure",
  uuid: "utility.uuid-generate",
  hash: "crypto.hash-multi",
  "time-convert": "time.convert-any",
  time: "time.convert-any",
  dns: "dns.records",
  mime: "mime.lookup",
  "block-number": "chain.block-number",
  lorem: "text.lorem",
  "text-stats": "text.stats",
  "x402-trending": "market.x402-trending",
  "address-label": "evm.address-label",
  "weather-current": "weather.current",
  "skill-locale-brief": "locale.brief",
  "skill-jwt-toolkit": "jwt.toolkit",
  base32: "encoding.base32",
  base58: "encoding.base58",
  "html-entities": "text.html-entities",
  roman: "number.roman",
  rot13: "text.rot13",
  "chain-info": "chain.info",
  "openapi-mock-response": "openapi.mock-response",
  "openapi-search": "openapi.search",
};

const MIME_BY_EXT: Record<string, string> = {
  txt:"text/plain", html:"text/html", htm:"text/html", css:"text/css", csv:"text/csv", json:"application/json", xml:"application/xml",
  js:"text/javascript", mjs:"text/javascript", pdf:"application/pdf", zip:"application/zip", gz:"application/gzip", wasm:"application/wasm",
  png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", svg:"image/svg+xml", ico:"image/x-icon", avif:"image/avif",
  mp3:"audio/mpeg", wav:"audio/wav", ogg:"audio/ogg", m4a:"audio/mp4", mp4:"video/mp4", webm:"video/webm", mov:"video/quicktime",
  md:"text/markdown", yaml:"application/yaml", yml:"application/yaml", rtf:"application/rtf", doc:"application/msword",
  docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls:"application/vnd.ms-excel",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt:"application/vnd.ms-powerpoint",
  pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation", eot:"application/vnd.ms-fontobject", ttf:"font/ttf", otf:"font/otf", woff:"font/woff", woff2:"font/woff2",
};

const CHAIN_INFO: Record<string, { chainId:number; name:string; nativeAsset:string; explorer:string; rpc:string }> = {
  base: { chainId:8453, name:"Base", nativeAsset:"ETH", explorer:"https://basescan.org", rpc:"https://mainnet.base.org" },
  ethereum: { chainId:1, name:"Ethereum", nativeAsset:"ETH", explorer:"https://etherscan.io", rpc:"https://ethereum-rpc.publicnode.com" },
  polygon: { chainId:137, name:"Polygon", nativeAsset:"POL", explorer:"https://polygonscan.com", rpc:"https://polygon-bor-rpc.publicnode.com" },
  arbitrum: { chainId:42161, name:"Arbitrum One", nativeAsset:"ETH", explorer:"https://arbiscan.io", rpc:"https://arb1.arbitrum.io/rpc" },
  optimism: { chainId:10, name:"Optimism", nativeAsset:"ETH", explorer:"https://optimistic.etherscan.io", rpc:"https://mainnet.optimism.io" },
};
const CHAIN_ALIASES: Record<string,string> = { "1":"ethereum", "8453":"base", "137":"polygon", "42161":"arbitrum", "10":"optimism", eth:"ethereum", op:"optimism", arb:"arbitrum" };

const ADDRESS_LABELS: Record<string, Record<string, { label:string; category:string }>> = {
  ethereum: {
    "0x0000000000000000000000000000000000000000": { label:"Zero address", category:"system" },
    "0x000000000000000000000000000000000000dead": { label:"Burn address", category:"system" },
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { label:"USDC", category:"stablecoin" },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": { label:"USDT", category:"stablecoin" },
    "0x6b175474e89094c44da98b954eedeac495271d0f": { label:"DAI", category:"stablecoin" },
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { label:"WETH", category:"wrapped-asset" },
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": { label:"WBTC", category:"wrapped-asset" },
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": { label:"Uniswap V2 Router02", category:"dex-router" },
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": { label:"Uniswap SwapRouter02", category:"dex-router" },
    "0x1111111254eeb25477b68fb85ed929f73a960582": { label:"1inch Aggregation Router V5", category:"dex-router" },
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff": { label:"0x Exchange Proxy", category:"dex-router" },
  },
  base: {
    "0x0000000000000000000000000000000000000000": { label:"Zero address", category:"system" },
    "0x000000000000000000000000000000000000dead": { label:"Burn address", category:"system" },
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": { label:"USDC", category:"stablecoin" },
    "0x4200000000000000000000000000000000000006": { label:"WETH", category:"wrapped-asset" },
  },
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function n(v: unknown, name: string) {
  const x = Number(v);
  if (!Number.isFinite(x)) throw new Error(`${name} must be numeric`);
  return x;
}
function s(v: unknown) { return v == null ? "" : String(v); }
function countInput(input:any, max=100) {
  const count = input?.count == null ? 1 : Math.floor(n(input.count, "count"));
  if (count < 1 || count > max) throw new Error(`count must be 1-${max}`);
  return count;
}

function secureRandomInt(min:number,max:number) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error("min/max must be safe integers with max >= min");
  const range = BigInt(max - min + 1);
  if (range <= 0n) throw new Error("invalid integer range");
  const bits = range.toString(2).length;
  const bytes = Math.ceil(bits / 8);
  const space = 1n << BigInt(bytes * 8);
  const limit = space - (space % range);
  while (true) {
    const buf = randomBytes(bytes);
    let x = 0n;
    for (const b of buf) x = (x << 8n) | BigInt(b);
    if (x < limit) return Number(BigInt(min) + (x % range));
  }
}

function uuidV7() {
  const b = randomBytes(16);
  let ms = BigInt(Date.now());
  for (let i=5;i>=0;i--) { b[i] = Number(ms & 0xffn); ms >>= 8n; }
  b[6] = 0x70 | (b[6] & 0x0f);
  b[8] = 0x80 | (b[8] & 0x3f);
  const h = b.toString("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  while (out.length % 8) out += "=";
  return out;
}
function base32Decode(text:string) {
  const clean = text.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0, value = 0; const out:number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch); if (idx < 0) throw new Error("invalid base32 string");
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function base58Encode(buf:Buffer) {
  let x = BigInt("0x" + (buf.toString("hex") || "0")); let out = "";
  while (x > 0n) { const r = Number(x % 58n); out = BASE58_ALPHABET[r] + out; x /= 58n; }
  for (const byte of buf) { if (byte === 0) out = "1" + out; else break; }
  return out || "1";
}
function base58Decode(text:string) {
  if (!text || [...text].some(ch => !BASE58_ALPHABET.includes(ch))) throw new Error("invalid base58 string");
  let x = 0n; for (const ch of text) x = x * 58n + BigInt(BASE58_ALPHABET.indexOf(ch));
  let hex = x.toString(16); if (hex.length % 2) hex = "0" + hex;
  let buf = x === 0n ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  let leading = 0; for (const ch of text) { if (ch === "1") leading++; else break; }
  if (leading) buf = Buffer.concat([Buffer.alloc(leading), buf]);
  return buf;
}

function romanEncode(num:number) {
  if (!Number.isInteger(num) || num < 1 || num > 3999) throw new Error("integer must be 1-3999");
  const pairs:[number,string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let n=num,out=""; for (const [v,r] of pairs) while (n>=v){out+=r;n-=v;} return out;
}
function romanDecode(text:string) {
  const t=text.toUpperCase().trim(); if(!/^[IVXLCDM]+$/.test(t)) throw new Error("invalid Roman numeral");
  const vals:Record<string,number>={I:1,V:5,X:10,L:50,C:100,D:500,M:1000}; let total=0;
  for(let i=0;i<t.length;i++){ const cur=vals[t[i]], next=vals[t[i+1]]||0; total += cur<next ? -cur : cur; }
  if (romanEncode(total)!==t) throw new Error("Roman numeral is not canonical"); return total;
}

async function fixedJson(url:string, init?:RequestInit, timeoutMs=8000) {
  const c=new AbortController(); const timer=setTimeout(()=>c.abort(),timeoutMs);
  try {
    const r=await fetch(url,{...init,signal:c.signal,cache:"no-store"});
    const text=await r.text(); let body:any=null; try{body=text?JSON.parse(text):null}catch{}
    if(!r.ok) throw new Error(`upstream returned HTTP ${r.status}`); return body;
  } finally { clearTimeout(timer); }
}

async function latestBlock(input:any) {
  const raw=s(input?.network ?? input ?? "base").toLowerCase(); const key=CHAIN_ALIASES[raw]||raw; const chain=CHAIN_INFO[key];
  if(!chain) throw new Error(`network must be ${Object.keys(CHAIN_INFO).join(", ")}`);
  const body=await fixedJson(chain.rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_blockNumber",params:[]})});
  if(typeof body?.result!=="string" || !/^0x[0-9a-f]+$/i.test(body.result)) throw new Error("RPC returned no block number");
  return { network:key, chainId:chain.chainId, blockNumber:Number.parseInt(body.result,16), hex:body.result, source:chain.rpc };
}

async function currentWeather(input:any) {
  let latitude = input?.latitude == null ? null : n(input.latitude,"latitude");
  let longitude = input?.longitude == null ? null : n(input.longitude,"longitude");
  let place:any=null;
  if(latitude===null || longitude===null){
    const city=s(input?.city ?? input).trim(); if(!city) throw new Error("city or latitude/longitude is required");
    const geo=await fixedJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    place=Array.isArray(geo?.results)?geo.results[0]:null; if(!place) throw new Error("city not found"); latitude=Number(place.latitude); longitude=Number(place.longitude);
  }
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude!<-90||latitude!>90||longitude!<-180||longitude!>180) throw new Error("invalid latitude/longitude");
  const w=await fixedJson(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`);
  return { location: place?{name:place.name,country:place.country,admin1:place.admin1||null}:null, latitude, longitude, timezone:w?.timezone||null, current:w?.current||null, units:w?.current_units||null, source:"Open-Meteo" };
}

async function x402Trending(input:any) {
  const sort=s(input?.sort||"buyers").toLowerCase(); if(!["buyers","transactions","volume","trend"].includes(sort)) throw new Error("sort must be buyers, transactions, volume or trend");
  const limit=Math.min(50,Math.max(1,Math.floor(Number(input?.limit||10))));
  const first=await fixedJson("https://x402-list.com/api/v1/services?status=online&payment_ready=true&per_page=100&page=1");
  const rows:any[] = Array.isArray(first?.data)?first.data:[];
  const totalPages=Math.max(1,Math.min(5,Number(first?.meta?.total_pages||1)));
  if(totalPages>1){ const pages=await Promise.all(Array.from({length:totalPages-1},(_,i)=>fixedJson(`https://x402-list.com/api/v1/services?status=online&payment_ready=true&per_page=100&page=${i+2}`).catch(()=>({data:[]})))); for(const p of pages) if(Array.isArray(p?.data)) rows.push(...p.data); }
  const mapped=rows.map((r:any)=>{const t=r?.assessment?.traction||{}; return {slug:r?.slug,name:r?.name,category:r?.category||"Other",minPriceUsd:Number(r?.min_price_usd||0),volumeUsd30d:Number(t?.volume_usd_30d||0),transactions30d:Number(t?.tx_count_30d||0),buyers30d:Number(t?.unique_buyers_30d||0),trend7dVs30d:Number(t?.trend_7d_vs_30d||0)};});
  mapped.sort((a,b)=> sort==="volume"?b.volumeUsd30d-a.volumeUsd30d : sort==="transactions"?b.transactions30d-a.transactions30d : sort==="trend"?b.trend7dVs30d-a.trend7dVs30d : b.buyers30d-a.buyers30d);
  return { sort, observed:mapped.length, results:mapped.slice(0,limit), source:"x402-list.com payment-ready traction" };
}

function localDateParts(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return {year:Number(get("year")),month:Number(get("month")),day:Number(get("day")),weekday:get("weekday"),time:`${get("hour")}:${get("minute")}:${get("second")}`};
}
async function localeBrief(input:any) {
  const code=s(input?.countryCode ?? input?.code ?? input).trim().toUpperCase(); if(!/^[A-Z]{2}$/.test(code)) throw new Error("countryCode must be a 2-letter ISO code");
  const country:any=await runFactoryOperation("country.lookup",code); const timezone=Array.isArray(country?.timezones)&&country.timezones[0]?country.timezones[0]:"UTC";
  const now=new Date(); const lp=localDateParts(now,timezone); const holidays:any[]=await fixedJson(`https://date.nager.at/api/v3/PublicHolidays/${lp.year}/${code}`).catch(()=>[]);
  const start=new Date(Date.UTC(lp.year,lp.month-1,lp.day)); const weekday=start.getUTCDay(); const daysUntilSunday=(7-weekday)%7; let working=0;
  const holidaySet=new Set(holidays.map((h:any)=>s(h?.date)));
  for(let i=0;i<=daysUntilSunday;i++){const d=new Date(start.getTime()+i*86400000);const dow=d.getUTCDay();const iso=d.toISOString().slice(0,10);if(dow>=1&&dow<=5&&!holidaySet.has(iso))working++;}
  const upcoming=holidays.filter((h:any)=>s(h?.date)>=start.toISOString().slice(0,10)).slice(0,10).map((h:any)=>({date:h.date,name:h.localName||h.name,nameEnglish:h.name}));
  return { country, timezone, currentLocal:{date:`${lp.year}-${String(lp.month).padStart(2,"0")}-${String(lp.day).padStart(2,"0")}`,time:lp.time,weekday:lp.weekday}, workingDaysRemainingThisWeek:working, upcomingPublicHolidays:upcoming, holidaySource:"Nager.Date" };
}

function openApiSearch(input:any){
  const spec=input?.spec; const query=s(input?.query).trim().toLowerCase(); if(!spec||typeof spec!=="object"||!query) throw new Error("spec object and query are required"); const limit=Math.min(20,Math.max(1,Number(input?.limit||10))); const words=query.split(/\s+/).filter(Boolean); const rows:any[]=[];
  for(const [path,item] of Object.entries<any>(spec.paths||{})) for(const method of ["get","post","put","patch","delete","options","head"]){const op=item?.[method]; if(!op) continue; const hay=`${path} ${method} ${op.operationId||""} ${op.summary||""} ${op.description||""} ${(op.tags||[]).join(" ")}`.toLowerCase(); let score=hay.includes(query)?100:words.filter((w:string)=>hay.includes(w)).length; if(score) rows.push({score,path,method,operationId:op.operationId||null,summary:op.summary||null,tags:op.tags||[]});}
  rows.sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)); return {query,results:rows.slice(0,limit)};
}
function mockFromSchema(schema:any,depth=0):any{ if(depth>8)return null;if(schema==null)return null;if(schema.example!==undefined)return schema.example;if(schema.default!==undefined)return schema.default;if(Array.isArray(schema.enum)&&schema.enum.length)return schema.enum[0];if(schema.const!==undefined)return schema.const;const type=Array.isArray(schema.type)?schema.type.find((x:string)=>x!=="null"):schema.type;if(type==="object"||schema.properties){return Object.fromEntries(Object.entries<any>(schema.properties||{}).map(([k,v])=>[k,mockFromSchema(v,depth+1)]));}if(type==="array")return [mockFromSchema(schema.items||{},depth+1)];if(type==="integer"||type==="number")return schema.minimum??0;if(type==="boolean")return true;if(type==="string")return schema.format==="date-time"?"2026-01-01T00:00:00Z":schema.format==="date"?"2026-01-01":"string";return null;}
function openApiMock(input:any){const spec=input?.spec,path=s(input?.path),method=s(input?.method||"get").toLowerCase(),status=s(input?.status||"200");const op=spec?.paths?.[path]?.[method];if(!op)throw new Error("path/method not found in spec");const responses=op.responses||{};const resp=responses[status]||responses["default"]||responses[Object.keys(responses)[0]];if(!resp)throw new Error("operation has no response definition");const content=resp.content||{};const media=content["application/json"]||content[Object.keys(content)[0]]||{};const value=media.example!==undefined?media.example:mockFromSchema(media.schema||{});return {path,method,status:responses[status]?status:(responses.default?"default":Object.keys(responses)[0]),mock:value};}

function jwtToolkit(input:any){
  const token=s(input?.token??input).trim(),secret=input?.secret==null?null:s(input.secret); const parts=token.split("."); if(parts.length!==3)throw new Error("token must be a three-part JWT");
  const parse=(x:string)=>{try{return JSON.parse(Buffer.from(x.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));}catch{throw new Error("invalid JWT JSON segment");}}; const header=parse(parts[0]),payload=parse(parts[1]); const alg=s(header?.alg); let verified:null|boolean=null;
  if(secret!==null){const map:Record<string,string>={HS256:"sha256",HS384:"sha384",HS512:"sha512"};const hash=map[alg];if(!hash)throw new Error("secret verification supports HS256, HS384 or HS512 only");const expected=createHmac(hash,secret).update(`${parts[0]}.${parts[1]}`).digest();let got:Buffer;try{got=Buffer.from(parts[2].replace(/-/g,"+").replace(/_/g,"/"),"base64");}catch{got=Buffer.alloc(0);}verified=got.length===expected.length&&timingSafeEqual(got,expected);}
  const now=Math.floor(Date.now()/1000); const claims={exp:typeof payload?.exp==="number"?{unix:payload.exp,iso:new Date(payload.exp*1000).toISOString(),expired:payload.exp<now}:null,nbf:typeof payload?.nbf==="number"?{unix:payload.nbf,iso:new Date(payload.nbf*1000).toISOString(),active:payload.nbf<=now}:null,iat:typeof payload?.iat==="number"?{unix:payload.iat,iso:new Date(payload.iat*1000).toISOString()}:null};
  return {header,payload,claims,verified,verification:secret===null?"not requested":`HMAC ${alg}`};
}

export async function runProvenPrimitive(template:string,input:any):Promise<any> {
  switch(template){
    case "secure-random": { const count=countInput(input); if(input?.min!=null||input?.max!=null){const min=Math.floor(n(input?.min,"min")),max=Math.floor(n(input?.max,"max"));const values=Array.from({length:count},()=>secureRandomInt(min,max));return {mode:"integer",min,max,count,values:count===1?values[0]:values};} const bytes=Math.floor(n(input?.bytes??16,"bytes"));if(bytes<1||bytes>1024)throw new Error("bytes must be 1-1024");const values=Array.from({length:count},()=>randomBytes(bytes).toString("hex"));return {mode:"bytes",bytes,count,hex:count===1?values[0]:values}; }
    case "uuid-generate": {const version=Number(input?.version??4);if(version!==4&&version!==7)throw new Error("version must be 4 or 7");const count=countInput(input);const values=Array.from({length:count},()=>version===4?randomUUID():uuidV7());return {version,count,uuids:count===1?values[0]:values};}
    case "hash-multi": {const text=s(input?.text??input),algorithm=s(input?.algorithm||"sha256").toLowerCase();if(!["sha256","sha512","sha1","md5"].includes(algorithm))throw new Error("algorithm must be sha256, sha512, sha1 or md5");const h=createHash(algorithm).update(text);const digest=h.digest();return {algorithm,hex:digest.toString("hex"),base64:digest.toString("base64"),bytes:digest.length};}
    case "mime-lookup": {const ext=s(input?.ext).replace(/^\./,"").toLowerCase(),type=s(input?.type).toLowerCase();if(ext){return {ext,mime:MIME_BY_EXT[ext]||null,found:Boolean(MIME_BY_EXT[ext])};}if(type){const extensions=Object.entries(MIME_BY_EXT).filter(([,v])=>v===type).map(([k])=>k);return {type,extensions,found:extensions.length>0};}throw new Error("ext or type is required");}
    case "time-convert": {const raw=input?.value??input;let ms:number;if(typeof raw==="number"||/^\d+(?:\.\d+)?$/.test(s(raw).trim())){const x=Number(raw);ms=Math.abs(x)>=1e12?x:x*1000;}else{ms=new Date(s(raw)).getTime();}if(!Number.isFinite(ms))throw new Error("value must be epoch seconds/ms or a parseable date");const date=new Date(ms),timezone=s(input?.timezone||"UTC");let local:string;try{local=new Intl.DateTimeFormat("en-US",{timeZone:timezone,dateStyle:"full",timeStyle:"long"}).format(date);}catch{throw new Error("invalid IANA timezone");}return {iso:date.toISOString(),unixSeconds:Math.floor(ms/1000),unixMilliseconds:ms,timezone,local};}
    case "base32": {const mode=s(input?.mode||"encode").toLowerCase(),value=s(input?.value??input);if(mode==="encode")return {encoded:base32Encode(Buffer.from(value,"utf8"))};if(mode==="decode")return {decoded:base32Decode(value).toString("utf8")};throw new Error("mode must be encode or decode");}
    case "base58": {const mode=s(input?.mode||"encode").toLowerCase(),value=s(input?.value??input);if(mode==="encode")return {encoded:base58Encode(Buffer.from(value,"utf8"))};if(mode==="decode")return {decoded:base58Decode(value).toString("utf8")};throw new Error("mode must be encode or decode");}
    case "html-entities": {const mode=s(input?.mode||"encode").toLowerCase(),value=s(input?.value??input);if(mode==="encode")return {result:value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#39;")};if(mode==="decode"){const named:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:"\u00a0"};return {result:value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,x:string)=>x[0]==="#"?(x[1].toLowerCase()==="x"?String.fromCodePoint(parseInt(x.slice(2),16)):String.fromCodePoint(parseInt(x.slice(1),10))):(named[x.toLowerCase()]??_))};}throw new Error("mode must be encode or decode");}
    case "rot13": {const value=s(input?.value??input);return {result:value.replace(/[a-z]/gi,c=>String.fromCharCode(c.charCodeAt(0)+(c.toLowerCase()<"n"?13:-13)))};}
    case "roman": {if(typeof input==="number"||typeof input?.value==="number")return {integer:Number(input?.value??input),roman:romanEncode(Number(input?.value??input))};const value=s(input?.value??input).trim();return {roman:value.toUpperCase(),integer:romanDecode(value)};}
    case "lorem": {const paragraphs=Math.min(10,Math.max(1,Math.floor(Number(input?.paragraphs||1))));const p="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";return {paragraphs,text:Array.from({length:paragraphs},()=>p).join("\n\n")};}
    case "text-stats": {const text=s(input?.text??input);return {characters:[...text].length,bytes:Buffer.byteLength(text,"utf8"),words:(text.trim().match(/\S+/g)||[]).length,lines:text===""?0:text.split(/\r?\n/).length,nonEmptyLines:text.split(/\r?\n/).filter(x=>x.trim()).length};}
    case "block-number": return latestBlock(input);
    case "chain-info": {const raw=s(input?.network??input).toLowerCase();const key=CHAIN_ALIASES[raw]||raw;const chain=CHAIN_INFO[key]||Object.values(CHAIN_INFO).find(x=>String(x.chainId)===raw);if(!chain)throw new Error("unknown supported chain");return chain;}
    case "address-label": {const network=s(input?.network||"ethereum").toLowerCase(),address=s(input?.address??input).toLowerCase();if(!/^0x[0-9a-f]{40}$/.test(address))throw new Error("address must be a 20-byte EVM address");const hit=ADDRESS_LABELS[network]?.[address];return {network,address,found:Boolean(hit),...(hit||{}),datasetRevision:"2026-08-28-v1"};}
    case "weather-current": return currentWeather(input);
    case "x402-trending": return x402Trending(input);
    case "locale-brief": return localeBrief(input);
    case "openapi-search": return openApiSearch(input);
    case "openapi-mock": return openApiMock(input);
    case "jwt-toolkit": return jwtToolkit(input);
    default: throw new Error("unknown proven primitive");
  }
}
