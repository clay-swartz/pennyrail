import { createHmac, timingSafeEqual } from "node:crypto";
import {
  registerThe402Provider,
  type The402Credentials,
} from "@/lib/the402";

let cachedCredentials: Promise<The402Credentials> | null = null;

function bootstrapSecret() {
  return (
    process.env.RADAR_ADMIN_TOKEN?.trim() ||
    process.env.CDP_WALLET_SECRET?.trim() ||
    process.env.CDP_API_KEY_SECRET?.trim() ||
    ""
  );
}

function bootstrapToken() {
  const secret = bootstrapSecret();
  if (!secret) return "";
  return createHmac("sha256", secret)
    .update("pennyrail-the402-bootstrap-v57")
    .digest("hex")
    .slice(0, 40);
}

function safeEqual(a: string, b: string) {
  try {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

export function the402WebhookUrl(origin: string) {
  const token = bootstrapToken();
  const base = `${origin.replace(/\/$/, "")}/api/the402/webhook`;
  return token ? `${base}?bootstrap=${encodeURIComponent(token)}` : base;
}

export function isAuthorizedThe402BootstrapRequest(req: Request) {
  const expected = bootstrapToken();
  if (!expected) return false;
  const actual = new URL(req.url).searchParams.get("bootstrap") || "";
  return safeEqual(actual, expected);
}

export async function getThe402RuntimeCredentials(
  origin: string,
): Promise<The402Credentials> {
  const participant_id = process.env.THE402_PARTICIPANT_ID?.trim() || "";
  const api_key = process.env.THE402_API_KEY?.trim() || "";
  const webhook_secret = process.env.THE402_WEBHOOK_SECRET?.trim() || "";

  if (participant_id && api_key && webhook_secret) {
    return {
      participant_id,
      api_key,
      webhook_secret,
      type: "provider",
    };
  }

  if (!bootstrapSecret()) {
    throw new Error(
      "the402 auto-registration needs RADAR_ADMIN_TOKEN, CDP_WALLET_SECRET, or CDP_API_KEY_SECRET",
    );
  }

  if (!cachedCredentials) {
    cachedCredentials = registerThe402Provider(the402WebhookUrl(origin)).catch(
      error => {
        cachedCredentials = null;
        throw error;
      },
    );
  }

  return cachedCredentials;
}
