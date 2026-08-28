import { createHash } from "node:crypto";

type AnyObj = Record<string, any>;

export type FactoryCapability = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  inputHint: string;
  network?: boolean;
};

export const FACTORY_CAPABILITIES: FactoryCapability[] = [
  { id: "text.normalize-whitespace", title: "Normalize whitespace", description: "Collapse repeated whitespace and trim text.", keywords: ["normalize whitespace", "collapse whitespace", "clean whitespace", "extra spaces"], inputHint: "string" },
  { id: "text.slugify", title: "Slugify text", description: "Convert text to a lowercase URL-safe slug.", keywords: ["slugify", "url slug", "slug text"], inputHint: "string" },
  { id: "text.lines-dedupe", title: "Deduplicate lines", description: "Remove duplicate text lines while preserving first occurrence order.", keywords: ["dedupe lines", "deduplicate lines", "remove duplicate lines", "unique lines"], inputHint: "string or string[]" },
  { id: "text.lines-sort", title: "Sort lines", description: "Sort lines lexicographically.", keywords: ["sort lines", "alphabetize lines", "order lines"], inputHint: "string or string[]" },
  { id: "text.extract-emails", title: "Extract emails", description: "Extract unique email addresses from text.", keywords: ["extract emails", "find email addresses", "parse emails"], inputHint: "string" },
  { id: "text.extract-urls", title: "Extract URLs", description: "Extract unique HTTP(S) URLs from text.", keywords: ["extract urls", "find urls", "parse links", "extract links"], inputHint: "string" },
  { id: "text.word-frequency", title: "Word frequency", description: "Count normalized word frequency in text.", keywords: ["word frequency", "word counts", "count words frequency", "term frequency"], inputHint: "string" },
  { id: "text.truncate", title: "Truncate text", description: "Truncate text to a maximum character count.", keywords: ["truncate text", "shorten to characters", "limit characters"], inputHint: "{text,max}" },

  { id: "json.flatten", title: "Flatten JSON", description: "Flatten nested JSON objects to dot-path keys.", keywords: ["flatten json", "flatten object", "dot path json"], inputHint: "JSON object" },
  { id: "json.get", title: "Get JSON path", description: "Read a value from JSON using a dot path.", keywords: ["json path get", "get nested json", "read dot path", "json lookup"], inputHint: "{value,path}" },
  { id: "json.keys", title: "List JSON keys", description: "List all leaf dot paths in a JSON value.", keywords: ["json keys", "list json paths", "json fields", "object paths"], inputHint: "JSON value" },
  { id: "json.sort-keys", title: "Sort JSON keys", description: "Recursively sort object keys.", keywords: ["sort json keys", "canonical json", "stable json", "normalize json"], inputHint: "JSON value" },

  { id: "url.parse", title: "Parse URL", description: "Parse an absolute URL into structured components.", keywords: ["parse url", "url components", "split url", "url metadata"], inputHint: "string URL" },
  { id: "url.normalize", title: "Normalize URL", description: "Normalize host casing, default ports, fragments, trailing slash and sorted query parameters.", keywords: ["normalize url", "canonical url", "clean url"], inputHint: "string URL" },
  { id: "url.resolve", title: "Resolve relative URL", description: "Resolve a relative URL against an absolute base URL.", keywords: ["resolve relative url", "absolute url from relative", "join url"], inputHint: "{base,relative}" },
  { id: "url.query-to-json", title: "Query string to JSON", description: "Convert a URL query string to a JSON object.", keywords: ["query string to json", "parse query params", "url params to json"], inputHint: "string" },
  { id: "url.json-to-query", title: "JSON to query string", description: "Convert a flat JSON object to a URL query string.", keywords: ["json to query string", "build query params", "object to url params"], inputHint: "object" },

  { id: "number.stats", title: "Numeric statistics", description: "Return count, min, max, sum, mean, median and population standard deviation.", keywords: ["number stats", "basic statistics", "mean median", "numeric summary"], inputHint: "number[]" },
  { id: "number.percent-change", title: "Percent change", description: "Calculate percent change from one numeric value to another.", keywords: ["percent change", "percentage change", "growth percent", "change percentage"], inputHint: "{from,to}" },
  { id: "number.clamp", title: "Clamp number", description: "Clamp a number between minimum and maximum bounds.", keywords: ["clamp number", "bound number", "limit number range"], inputHint: "{value,min,max}" },

  { id: "time.to-iso", title: "Timestamp to ISO", description: "Convert a Unix timestamp or parseable date into ISO-8601 UTC.", keywords: ["timestamp to iso", "date to iso", "unix to iso"], inputHint: "number|string" },
  { id: "time.to-unix", title: "Date to Unix", description: "Convert a parseable date to Unix seconds and milliseconds.", keywords: ["date to unix", "iso to timestamp", "unix timestamp"], inputHint: "string" },

  { id: "encoding.base64-encode", title: "Base64 encode", description: "Encode UTF-8 text as Base64.", keywords: ["base64 encode", "encode base64"], inputHint: "string" },
  { id: "encoding.base64-decode", title: "Base64 decode", description: "Decode Base64 into UTF-8 text.", keywords: ["base64 decode", "decode base64"], inputHint: "string" },
  { id: "encoding.hex-encode", title: "Hex encode", description: "Encode UTF-8 text as hexadecimal.", keywords: ["hex encode", "text to hex"], inputHint: "string" },
  { id: "encoding.hex-decode", title: "Hex decode", description: "Decode hexadecimal into UTF-8 text.", keywords: ["hex decode", "hex to text"], inputHint: "string" },
  { id: "crypto.sha256", title: "SHA-256", description: "Hash UTF-8 text with SHA-256.", keywords: ["sha256", "sha-256", "hash text", "sha hash"], inputHint: "string" },

  { id: "dns.a", title: "DNS A lookup", description: "Resolve IPv4 A records through Cloudflare DNS-over-HTTPS.", keywords: ["dns lookup", "resolve domain ip", "a record", "domain ip address"], inputHint: "domain string", network: true },
  { id: "npm.latest", title: "NPM latest package info", description: "Return current latest npm package metadata from the public npm registry.", keywords: ["npm latest version", "npm package info", "package version npm", "npm registry"], inputHint: "package name", network: true },
  { id: "github.repo", title: "GitHub repo metadata", description: "Return public GitHub repository metadata.", keywords: ["github repo info", "repository metadata", "github stars", "github repository"], inputHint: "owner/repo", network: true },
  { id: "fx.convert", title: "Currency conversion", description: "Convert currency using Frankfurter/ECB reference rates.", keywords: ["currency convert", "exchange rate", "fx conversion", "convert usd eur"], inputHint: "{amount,from,to}", network: true },
  { id: "country.lookup", title: "Country code lookup", description: "Resolve ISO country code to basic public country metadata.", keywords: ["country code lookup", "iso country", "country metadata", "country from code"], inputHint: "2 or 3 letter country code", network: true },
];

function asText(input: any) {
  if (typeof input === "string") return input;
  if (input == null) return "";
  return String(input);
}

function asLines(input: any) {
  if (Array.isArray(input)) return input.map(asText);
  return asText(input).split(/\r?\n/);
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((out: AnyObj, key) => {
      out[key] = sortKeys(value[key]);
      return out;
    }, {});
  }
  return value;
}

function flatten(value: any, prefix = "", out: AnyObj = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, prefix ? `${prefix}.${index}` : String(index), out));
  } else if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length && prefix) out[prefix] = {};
    for (const key of keys) flatten(value[key], prefix ? `${prefix}.${key}` : key, out);
  } else if (prefix) {
    out[prefix] = value;
  }
  return out;
}

function getPath(value: any, path: string) {
  if (!path) return value;
  return path.split(".").reduce((cur: any, key) => cur == null ? undefined : cur[key], value);
}

function wordFrequency(text: string) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  const counts: Record<string, number> = {};
  for (const word of words) counts[word] = (counts[word] || 0) + 1;
  return Object.entries(counts).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([word,count]) => ({ word, count }));
}

function numericStats(values: any[]) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if (!nums.length) throw new Error("input must contain at least one finite number");
  const sum = nums.reduce((a,b)=>a+b,0);
  const mean = sum / nums.length;
  const median = nums.length % 2 ? nums[(nums.length-1)/2] : (nums[nums.length/2-1] + nums[nums.length/2]) / 2;
  const variance = nums.reduce((s,n)=>s+(n-mean)**2,0)/nums.length;
  return { count: nums.length, min: nums[0], max: nums[nums.length-1], sum, mean, median, standardDeviation: Math.sqrt(variance) };
}

async function fixedJson(url: string, headers?: Record<string,string>) {
  const response = await fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`upstream returned HTTP ${response.status}`);
  return response.json();
}

export async function runFactoryOperation(operation: string, input: any) {
  switch (operation) {
    case "text.normalize-whitespace": return { result: asText(input).replace(/\s+/g, " ").trim() };
    case "text.slugify": return { result: asText(input).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") };
    case "text.lines-dedupe": return { lines: [...new Set(asLines(input))] };
    case "text.lines-sort": return { lines: asLines(input).sort((a,b)=>a.localeCompare(b)) };
    case "text.extract-emails": return { emails: [...new Set(asText(input).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])] };
    case "text.extract-urls": return { urls: [...new Set(asText(input).match(/https?:\/\/[^\s<>'\"]+/gi) || [])] };
    case "text.word-frequency": return { words: wordFrequency(asText(input)) };
    case "text.truncate": {
      const text = asText(input?.text ?? input);
      const max = Math.max(0, Math.min(1_000_000, Number(input?.max ?? 1000)));
      return { result: [...text].slice(0,max).join(""), originalCharacters: [...text].length, max };
    }
    case "json.flatten": return { flattened: flatten(input) };
    case "json.get": return { value: getPath(input?.value, asText(input?.path)), found: getPath(input?.value, asText(input?.path)) !== undefined };
    case "json.keys": return { paths: Object.keys(flatten(input)).sort() };
    case "json.sort-keys": return { value: sortKeys(input) };
    case "url.parse": {
      const u = new URL(asText(input));
      return { protocol:u.protocol, username:u.username, password:u.password?"[redacted]":"", hostname:u.hostname, port:u.port, pathname:u.pathname, search:u.search, hash:u.hash, origin:u.origin };
    }
    case "url.normalize": {
      const u = new URL(asText(input));
      u.hostname = u.hostname.toLowerCase();
      u.hash = "";
      if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) u.port = "";
      const entries = [...u.searchParams.entries()].sort(([a,av],[b,bv]) => a.localeCompare(b) || av.localeCompare(bv));
      u.search = "";
      for (const [k,v] of entries) u.searchParams.append(k,v);
      if (u.pathname === "/") u.pathname = "";
      return { url: u.toString() };
    }
    case "url.resolve": return { url: new URL(asText(input?.relative), asText(input?.base)).toString() };
    case "url.query-to-json": {
      const raw = asText(input).replace(/^\?/, "");
      const params = new URLSearchParams(raw); const out: AnyObj = {};
      for (const [k,v] of params) out[k] = k in out ? (Array.isArray(out[k]) ? [...out[k],v] : [out[k],v]) : v;
      return { value: out };
    }
    case "url.json-to-query": {
      const params = new URLSearchParams();
      for (const [k,v] of Object.entries(input || {})) {
        if (Array.isArray(v)) for (const item of v) params.append(k, asText(item));
        else if (v != null) params.append(k, asText(v));
      }
      return { query: params.toString() };
    }
    case "number.stats": return numericStats(Array.isArray(input) ? input : input?.values || []);
    case "number.percent-change": {
      const from = Number(input?.from), to = Number(input?.to);
      if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error("from and to must be finite numbers");
      if (from === 0) throw new Error("percent change from zero is undefined");
      return { from, to, percentChange: ((to-from)/Math.abs(from))*100 };
    }
    case "number.clamp": {
      const value=Number(input?.value), min=Number(input?.min), max=Number(input?.max);
      if (![value,min,max].every(Number.isFinite)) throw new Error("value, min and max must be finite numbers");
      if (min>max) throw new Error("min cannot exceed max");
      return { value: Math.min(max,Math.max(min,value)) };
    }
    case "time.to-iso": {
      const raw = input?.value ?? input;
      const d = typeof raw === "number" ? new Date(Math.abs(raw) < 1e12 ? raw*1000 : raw) : new Date(asText(raw));
      if (!Number.isFinite(d.getTime())) throw new Error("invalid date/timestamp");
      return { iso: d.toISOString() };
    }
    case "time.to-unix": {
      const d = new Date(asText(input?.value ?? input));
      if (!Number.isFinite(d.getTime())) throw new Error("invalid date");
      return { unixSeconds: Math.floor(d.getTime()/1000), unixMilliseconds: d.getTime(), iso: d.toISOString() };
    }
    case "encoding.base64-encode": return { result: Buffer.from(asText(input), "utf8").toString("base64") };
    case "encoding.base64-decode": return { result: Buffer.from(asText(input).replace(/-/g,"+").replace(/_/g,"/"), "base64").toString("utf8") };
    case "encoding.hex-encode": return { result: Buffer.from(asText(input), "utf8").toString("hex") };
    case "encoding.hex-decode": {
      const text = asText(input).trim(); if (!/^(?:[0-9a-fA-F]{2})*$/.test(text)) throw new Error("invalid even-length hexadecimal string");
      return { result: Buffer.from(text, "hex").toString("utf8") };
    }
    case "crypto.sha256": return { sha256: createHash("sha256").update(asText(input)).digest("hex") };
    case "dns.a": {
      const domain = asText(input?.domain ?? input).trim().replace(/\.$/, "");
      if (!/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$/.test(domain)) throw new Error("invalid domain");
      const body = await fixedJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, { accept: "application/dns-json" });
      return { domain, addresses: (body.Answer || []).filter((x:any)=>x.type===1).map((x:any)=>x.data), status: body.Status };
    }
    case "npm.latest": {
      const name = asText(input?.name ?? input).trim();
      if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name)) throw new Error("invalid npm package name");
      const p = await fixedJson(`https://registry.npmjs.org/${encodeURIComponent(name).replace('%40','@').replace('%2F','%2F')}/latest`);
      return { name:p.name, version:p.version, description:p.description||null, license:p.license||null, homepage:p.homepage||null };
    }
    case "github.repo": {
      const repo = asText(input?.repo ?? input).trim();
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("repo must be owner/name");
      const r = await fixedJson(`https://api.github.com/repos/${repo}`, { accept:"application/vnd.github+json", "user-agent":"PennyRail/1.0" });
      return { fullName:r.full_name, description:r.description, stars:r.stargazers_count, forks:r.forks_count, openIssues:r.open_issues_count, defaultBranch:r.default_branch, language:r.language, license:r.license?.spdx_id||null, pushedAt:r.pushed_at, archived:r.archived };
    }
    case "fx.convert": {
      const amount = Number(input?.amount ?? 1); const from = asText(input?.from).toUpperCase(); const to = asText(input?.to).toUpperCase();
      if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) throw new Error("amount must be numeric; from/to must be 3-letter currency codes");
      const r = await fixedJson(`https://api.frankfurter.app/latest?amount=${encodeURIComponent(amount)}&from=${from}&to=${to}`);
      return { amount, from, to, result:r.rates?.[to], date:r.date };
    }
    case "country.lookup": {
      const code = asText(input?.code ?? input).trim().toUpperCase();
      if (!/^[A-Z]{2,3}$/.test(code)) throw new Error("country code must be 2 or 3 letters");
      const rows = await fixedJson(`https://restcountries.com/v3.1/alpha/${code}?fields=name,cca2,cca3,capital,currencies,languages,timezones`);
      const c = Array.isArray(rows) ? rows[0] : rows;
      return { name:c?.name?.common||null, officialName:c?.name?.official||null, cca2:c?.cca2, cca3:c?.cca3, capital:c?.capital||[], currencies:c?.currencies||{}, languages:c?.languages||{}, timezones:c?.timezones||[] };
    }
    default: throw new Error(`unsupported operation: ${operation}`);
  }
}

function norm(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}

export function matchCapability(need: string) {
  const n = norm(need);
  let best: { capability: FactoryCapability; score: number } | null = null;
  for (const capability of FACTORY_CAPABILITIES) {
    let score = 0;
    for (const keyword of capability.keywords) {
      const k = norm(keyword);
      if (n.includes(k)) score += 8 + k.split(" ").length;
      else {
        const words = k.split(" ");
        const hits = words.filter(w => n.includes(w)).length;
        score += hits / Math.max(1,words.length) >= .67 ? hits : 0;
      }
    }
    if (!best || score > best.score) best = { capability, score };
  }
  return best && best.score >= 3 ? best : null;
}
