import { createHmac, timingSafeEqual } from "node:crypto";

export const RADAR_SESSION_COOKIE = "pennyrail_radar_session";
export const RADAR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_LABEL = "pennyrail-radar-session-v1";

function adminSecret() { return process.env.RADAR_ADMIN_TOKEN?.trim() || ""; }

function safeEqual(a: string, b: string) {
  try {
    const aa = Buffer.from(a);
    const bb = Buffer.from(b);
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch { return false; }
}

function signExpiry(exp: number) {
  const secret = adminSecret();
  return secret ? createHmac("sha256", secret).update(`${SESSION_LABEL}:${exp}`).digest("hex") : "";
}

function cookieValue(headers: Headers) {
  const raw = headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === RADAR_SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function validSessionValue(value: string) {
  const [expRaw, signature, ...extra] = value.split(".");
  if (!expRaw || !signature || extra.length) return false;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (exp <= now || exp > now + RADAR_SESSION_MAX_AGE_SECONDS + 300) return false;
  return safeEqual(signature, signExpiry(exp));
}

export function isRadarAdmin(req: Request) {
  const secret = adminSecret();
  if (!secret) return false;
  const header = req.headers.get("x-admin-token") || "";
  if (header && safeEqual(header, secret)) return true;
  const cookie = cookieValue(req.headers);
  return Boolean(cookie && validSessionValue(cookie));
}

export function isRadarToken(token: string) {
  const secret = adminSecret();
  return Boolean(secret && token && safeEqual(token, secret));
}

export function radarSessionValue() {
  const exp = Math.floor(Date.now() / 1000) + RADAR_SESSION_MAX_AGE_SECONDS;
  return `${exp}.${signExpiry(exp)}`;
}
