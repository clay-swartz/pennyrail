import jwt from "jsonwebtoken";

export function verifyWixWebhook(token) {
  const publicKey = process.env.WIX_WEBHOOK_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (!publicKey) throw new Error("WIX_WEBHOOK_PUBLIC_KEY is not configured");
  return jwt.verify(token, publicKey, { algorithms: ["RS256"] });
}

export async function getWixAccessToken(instanceId) {
  const clientId = process.env.WIX_APP_ID;
  const clientSecret = process.env.WIX_APP_SECRET;
  if (!clientId || !clientSecret) throw new Error("Wix OAuth credentials are not configured");

  const r = await fetch("https://www.wixapis.com/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      instance_id: instanceId
    })
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(`Wix token HTTP ${r.status}: ${raw.slice(0, 300)}`);
  const body = JSON.parse(raw);
  return body.access_token || body.accessToken;
}

export async function wixFetch(path, instanceId, init = {}) {
  const token = await getWixAccessToken(instanceId);
  const r = await fetch(`https://www.wixapis.com${path}`, {
    ...init,
    headers: {
      Authorization: token,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });

  const raw = await r.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  if (!r.ok) throw new Error(`Wix ${path} HTTP ${r.status}: ${typeof body === "string" ? body.slice(0,300) : JSON.stringify(body).slice(0,300)}`);
  return body;
}

export async function getOrder(orderId, instanceId) {
  return wixFetch(`/ecom/v1/orders/${encodeURIComponent(orderId)}`, instanceId);
}
