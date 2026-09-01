import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { withX402 } from "@x402/next";
import { penny, x402Server } from "@/lib/x402-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_URLS = 5;
const MAX_BYTES = 768 * 1024;
const MAX_TEXT_CHARS = 80_000;
const USER_AGENT = "PennyRail/1.0 paid-url-contents";

type UrlContentsItem = {
  id: string;
  url: string;
  title?: string | null;
  status?: number;
  contentType?: string | null;
  text?: string;
  highlights?: string[];
  error?: string;
};

type UrlContentsResponse = {
  ok?: boolean;
  error?: string;
  priceUsd?: number;
  service?: string;
  results?: UrlContentsItem[];
};

function json(
  body: UrlContentsResponse,
  status = 200,
): NextResponse<UrlContentsResponse> {
  return NextResponse.json<UrlContentsResponse>(body, { status });
}

function isPrivateIp(ip: string) {
  if (ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("::ffff:")) return isPrivateIp(ip.slice(7));

  const p = ip.split(".").map(Number);
  if (p.length != 4 || p.some(Number.isNaN)) return false;
  const [a, b] = p;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use http or https");
  }

  if (url.username || url.password) {
    throw new Error("URL credentials are not allowed");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost")
  ) {
    throw new Error("private/internal host is not allowed");
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new Error("private/internal IP is not allowed");
    }
  } else {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(row => isPrivateIp(row.address))) {
      throw new Error("URL resolved to a private/internal IP");
    }
  }

  return url;
}

async function safeFetch(raw: string) {
  let url = await assertPublicUrl(raw);

  for (let i = 0; i < 4; i++) {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        accept:
          "text/html,text/plain,application/json,application/xml,text/xml;q=0.9,*/*;q=0.5",
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) return response;

    url = await assertPublicUrl(new URL(location, url).toString());
  }

  throw new Error("too many redirects");
}

async function boundedText(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      throw new Error("response too large");
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > MAX_BYTES) {
      try {
        await reader.cancel();
      } catch {}
      throw new Error("response too large");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks.map(v => Buffer.from(v))).toString("utf8");
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (whole, key: string) => {
      if (/^#x/i.test(key)) {
        return String.fromCodePoint(parseInt(key.slice(2), 16));
      }
      if (key.startsWith("#")) {
        return String.fromCodePoint(parseInt(key.slice(1), 10));
      }
      return named[key.toLowerCase()] ?? whole;
    },
  );
}

function htmlToText(html: string) {
  const cleaned = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(
      /<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr)>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(cleaned)
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function titleFromHtml(html: string) {
  const raw = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const title = decodeEntities(
    raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
  return title || null;
}

function simpleHighlights(text: string) {
  return text
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(x => x.trim())
    .filter(x => x.length >= 80)
    .slice(0, 5)
    .map(x => x.slice(0, 600));
}

async function extractOne(
  rawUrl: string,
  includeText: boolean,
  includeHighlights: boolean,
): Promise<UrlContentsItem> {
  const response = await safeFetch(rawUrl);
  const body = await boundedText(response);
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const finalUrl = response.url || rawUrl;

  let text = "";
  let title: string | null = null;

  if (
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml")
  ) {
    text = htmlToText(body);
    title = titleFromHtml(body);
  } else if (
    contentType.includes("text/plain") ||
    contentType.includes("application/json") ||
    contentType.includes("application/xml") ||
    contentType.includes("text/xml") ||
    contentType.includes("text/")
  ) {
    text = body.trim().slice(0, MAX_TEXT_CHARS);
  } else {
    throw new Error(`unsupported content type: ${contentType || "unknown"}`);
  }

  return {
    id: finalUrl,
    url: finalUrl,
    title,
    status: response.status,
    contentType: contentType || null,
    ...(includeText ? { text } : {}),
    ...(includeHighlights ? { highlights: simpleHighlights(text) } : {}),
  };
}

async function execute(
  urls: string[],
  includeText: boolean,
  includeHighlights: boolean,
): Promise<NextResponse<UrlContentsResponse>> {
  if (!urls.length) {
    return json({ error: "url is required" }, 400);
  }

  if (urls.length > MAX_URLS) {
    return json({ error: `maximum ${MAX_URLS} URLs per call` }, 400);
  }

  const results: UrlContentsItem[] = [];

  for (const url of urls) {
    try {
      results.push(await extractOne(url, includeText, includeHighlights));
    } catch (error) {
      results.push({
        id: url,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return json({
    ok: true,
    priceUsd: 0.001,
    service: "PennyRail URL Contents",
    results,
  });
}

const getHandler = async (
  req: NextRequest,
): Promise<NextResponse<UrlContentsResponse>> => {
  const url = req.nextUrl.searchParams.get("url")?.trim() || "";
  const includeText = req.nextUrl.searchParams.get("text") !== "false";
  const includeHighlights =
    req.nextUrl.searchParams.get("highlights") === "1" ||
    req.nextUrl.searchParams.get("highlights") === "true";

  return execute(url ? [url] : [], includeText, includeHighlights);
};

const postHandler = async (
  req: NextRequest,
): Promise<NextResponse<UrlContentsResponse>> => {
  try {
    const body = await req.json();

    const rawUrls =
      Array.isArray(body?.urls) ? body.urls :
      Array.isArray(body?.ids) ? body.ids :
      body?.url ? [body.url] :
      [];

    const urls = rawUrls
      .map((value: unknown) => String(value || "").trim())
      .filter(Boolean);

    if (body?.summary) {
      return json(
        {
          error:
            "summary mode is not offered on the $0.001 tier; request text/highlights instead",
        },
        400,
      );
    }

    return execute(
      urls,
      body?.text !== false,
      Boolean(body?.highlights),
    );
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "invalid request",
      },
      400,
    );
  }
};

const resource = penny(
  "Retrieve clean text and optional highlights from known public URLs. Low-cost URL content extraction for agent research, RAG and page-reading workflows.",
  "$0.001",
  {
    serviceName: "PennyRail URL Contents",
    tags: [
      "url-contents",
      "web-extraction",
      "scrape",
      "research",
      "rag",
      "page-reader",
    ],
  },
);

export const GET = withX402(getHandler, resource, x402Server);
export const POST = withX402(postHandler, resource, x402Server);
