export type GapArbitrageProduct = {
  id: string;
  path: string;
  title: string;
  description: string;
  priceUsd: number;
  intents: string[];
  sampleInput: unknown;
};

export const GAP_ARBITRAGE_PRODUCTS: GapArbitrageProduct[] = [
  {
    id: "browser.render",
    path: "/api/agent/browser-render",
    title: "Browser render to clean Markdown",
    description: "Render a public webpage in a real headless browser with client-side JavaScript, then return clean LLM-ready Markdown. Built for SPAs and JS-heavy pages.",
    priceUsd: 0.015,
    intents: ["browser render", "render page", "headless browser", "javascript page", "spa render", "js heavy site", "browser extract"],
    sampleInput: { url: "https://example.com", maxChars: 100000 },
  },
  {
    id: "web.extract",
    path: "/api/agent/web-extract",
    title: "Web page extract to Markdown",
    description: "Extract the useful content from a public URL as clean Markdown for agents. Uses a browser-backed reader when needed and strips navigation/boilerplate.",
    priceUsd: 0.005,
    intents: ["web extract", "extract webpage", "read url", "page to markdown", "article extract", "url content", "firecrawl alternative"],
    sampleInput: { url: "https://example.com", maxChars: 100000 },
  },
  {
    id: "x402.quote",
    path: "/api/agent/x402-quote",
    title: "x402 payment quote inspector",
    description: "Probe a public HTTP endpoint without paying and decode its HTTP 402 payment requirements into clean JSON: status, network, asset, amount, pay-to and challenge metadata when exposed.",
    priceUsd: 0.002,
    intents: ["x402 quote", "inspect x402", "402 payment requirements", "payment required", "x402 price", "x402 network", "x402 pay to"],
    sampleInput: { url: "https://pennyrail.vercel.app/api/agent/hash", method: "POST", body: { text: "PennyRail", algorithm: "sha256" } },
  },
  {
    id: "data.hacker-news",
    path: "/api/agent/hacker-news",
    title: "Hacker News stories and full-text search",
    description: "Search Hacker News stories/comments or fetch front-page results from the public Algolia HN index. Returns titles, URLs, authors, points, comments and timestamps as clean JSON.",
    priceUsd: 0.005,
    intents: ["hacker news", "hn search", "hacker news search", "hn stories", "hacker news stories", "front page hacker news", "search hn"],
    sampleInput: { query: "AI agents", sort: "recent", limit: 10 },
  },
  {
    id: "json.schema-guard",
    path: "/api/agent/schema-guard",
    title: "JSON Schema guard",
    description: "Contract-test a JSON payload against a JSON Schema, infer the schema the payload implies, detect drift and return a normalized payload plus stable validation errors.",
    priceUsd: 0.02,
    intents: ["schema guard", "json schema guard", "contract test json", "json validate infer diff", "schema drift", "validate payload schema"],
    sampleInput: {
      schema: { type: "object", required: ["id"], properties: { id: { type: "integer" }, name: { type: "string" } } },
      payload: { id: 7, name: "Ada" }
    },
  },
  {
    id: "openapi.validate-payload",
    path: "/api/agent/openapi-validate",
    title: "OpenAPI payload validator",
    description: "Validate a JSON request or response payload against one OpenAPI 3.x / Swagger 2.x operation schema. Supports deterministic JSON-Schema validation rules without external calls.",
    priceUsd: 0.001,
    intents: ["openapi payload validator", "validate openapi payload", "openapi request validation", "openapi response validation", "swagger payload validate"],
    sampleInput: {
      spec: { openapi: "3.1.0", paths: { "/ping": { post: { requestBody: { content: { "application/json": { schema: { type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } } } } } } } } },
      path: "/ping",
      method: "post",
      part: "request",
      payload: { ok: true }
    },
  },
  {
    id: "json.query",
    path: "/api/agent/json-query",
    title: "JSON query",
    description: "Extract a value from JSON by dot/bracket path such as items[2].name. Deterministic, no network, returns found/value and normalized path.",
    priceUsd: 0.001,
    intents: ["json query", "json path", "extract json value", "dot bracket path", "items index json"],
    sampleInput: { value: { items: [{ name: "A" }, { name: "B" }] }, path: "items[1].name" },
  },
  {
    id: "color.convert",
    path: "/api/agent/color-convert",
    title: "Color convert",
    description: "Convert a CSS color between hex, RGB and HSL. Accepts #RRGGBB, rgb(r,g,b), hsl(h,s%,l%) or numeric RGB fields.",
    priceUsd: 0.001,
    intents: ["color convert", "hex to rgb", "rgb to hex", "hsl to rgb", "css color convert"],
    sampleInput: { value: "#1a2b3c" },
  },
  {
    id: "forecast.naive",
    path: "/api/agent/forecast-naive",
    title: "Naive baseline forecasts",
    description: "Generate mean, naive and drift baseline forecasts with simple 95% prediction intervals. Useful as a sanity floor before paying for a more complex forecasting model.",
    priceUsd: 0.001,
    intents: ["forecast naive", "naive forecast", "drift forecast", "mean forecast", "baseline forecast", "time series baseline"],
    sampleInput: { values: [10, 12, 13, 15, 16], horizon: 3 },
  },
];
