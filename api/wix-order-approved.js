import { verifyWixWebhook, getOrder } from "../lib/wix.js";

function extractToken(req) {
  if (typeof req.body === "string") return req.body.trim();
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8").trim();
  if (req.body?.token) return String(req.body.token);
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const token = extractToken(req);
    if (!token) return res.status(400).json({ ok: false, error: "missing_webhook_jwt" });

    const envelope = verifyWixWebhook(token);
    const instanceId = envelope?.data?.instanceId || envelope?.instanceId;
    const inner = envelope?.data?.data
      ? (typeof envelope.data.data === "string" ? JSON.parse(envelope.data.data) : envelope.data.data)
      : envelope?.data;

    const eventId = inner?.actionEvent?.id || inner?.id || null;
    const orderId = inner?.actionEvent?.entityId || inner?.entityId || null;

    if (!instanceId || !orderId) {
      return res.status(200).json({ ok: true, ignored: true, reason: "no_order_or_instance", eventId });
    }

    const order = await getOrder(orderId, instanceId);

    console.log(JSON.stringify({
      type: "wix.order.approved",
      instanceId,
      eventId,
      orderId,
      lineItems: order?.order?.lineItems || order?.lineItems || []
    }));

    return res.status(200).json({ ok: true, eventId, orderId, retrieved: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
