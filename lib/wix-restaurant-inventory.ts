import { createVerify } from "node:crypto";

const WIX_APP_ID = process.env.WIX_APP_ID?.trim() || "4bcf52e1-f9c8-45aa-a922-4e2ec697b590";
const RESTAURANTS_CATALOG_APP_ID = "9a5d83fd-8570-482e-81ab-cfa88942ee60";

function b64url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyWixJwt(token: string) {
  const [head, payload, signature] = token.split(".");
  if (!head || !payload || !signature) throw new Error("Malformed Wix webhook JWT");

  const pem = process.env.WIX_WEBHOOK_PUBLIC_KEY?.replace(/\\n/g, "\n").trim();
  if (!pem) throw new Error("WIX_WEBHOOK_PUBLIC_KEY is not configured");

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${head}.${payload}`);
  verifier.end();
  if (!verifier.verify(pem, b64url(signature))) throw new Error("Invalid Wix webhook signature");

  return JSON.parse(b64url(payload).toString("utf8"));
}

export function parseWixEvent(jwtPayload: any) {
  const outer = jwtPayload?.data || jwtPayload;
  const instanceId = outer?.instanceId || jwtPayload?.instanceId || null;
  let event = outer?.data ?? outer;
  if (typeof event === "string") event = JSON.parse(event);
  return { instanceId, event };
}

export async function wixAccessToken(instanceId: string) {
  const secret = process.env.WIX_APP_SECRET?.trim();
  if (!secret) throw new Error("WIX_APP_SECRET is not configured");

  const response = await fetch("https://www.wixapis.com/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: WIX_APP_ID,
      client_secret: secret,
      instance_id: instanceId,
    }),
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`Wix OAuth HTTP ${response.status}: ${raw.slice(0, 240)}`);

  const parsed = raw ? JSON.parse(raw) : {};
  const body = typeof parsed?.body === "string" ? JSON.parse(parsed.body) : parsed?.body || parsed;
  const token = body?.access_token || body?.accessToken;
  if (!token) throw new Error("Wix OAuth response did not contain an access token");
  return token as string;
}

export async function wixGet(path: string, instanceId: string) {
  const token = await wixAccessToken(instanceId);
  const response = await fetch(`https://www.wixapis.com${path}`, {
    headers: { Authorization: token, Accept: "application/json" },
    cache: "no-store",
  });

  const raw = await response.text();
  if (!response.ok) throw new Error(`Wix ${path} HTTP ${response.status}: ${raw.slice(0, 240)}`);
  return raw ? JSON.parse(raw) : {};
}

export async function getWixOrder(orderId: string, instanceId: string) {
  return wixGet(`/ecom/v1/orders/${encodeURIComponent(orderId)}`, instanceId);
}

export function restaurantLineItems(orderResponse: any) {
  const order = orderResponse?.order || orderResponse;
  const items = Array.isArray(order?.lineItems) ? order.lineItems : [];
  return items.filter((item: any) =>
    item?.catalogReference?.appId === RESTAURANTS_CATALOG_APP_ID
  );
}
