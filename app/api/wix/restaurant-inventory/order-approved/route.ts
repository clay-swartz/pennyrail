import { NextRequest, NextResponse } from "next/server";
import {
  getWixOrder,
  parseWixEvent,
  restaurantLineItems,
  verifyWixJwt,
} from "@/lib/wix-restaurant-inventory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const token = (await req.text()).trim();
    if (!token) return NextResponse.json({ ok: false, error: "empty_webhook" }, { status: 400 });

    const decoded = verifyWixJwt(token);
    const { instanceId, event } = parseWixEvent(decoded);

    const eventId = event?.id || event?.actionEvent?.id || event?.createdEvent?.id || null;
    const orderId = event?.entityId || event?.actionEvent?.entityId || null;

    if (!instanceId || !orderId) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "missing_instance_or_order",
        eventId,
      });
    }

    const orderResponse = await getWixOrder(orderId, instanceId);
    const restaurantItems = restaurantLineItems(orderResponse);

    console.log(JSON.stringify({
      type: "wix.restaurant-inventory.order-approved",
      eventId,
      instanceId,
      orderId,
      restaurantItemCount: restaurantItems.length,
      restaurantItems: restaurantItems.map((item: any) => ({
        id: item?.id || null,
        name: item?.productName?.original || item?.productName?.translated || item?.name || null,
        quantity: item?.quantity || 0,
        catalogItemId: item?.catalogReference?.catalogItemId || null,
        options: item?.catalogReference?.options || null,
      })),
    }));

    return NextResponse.json({
      ok: true,
      eventId,
      orderId,
      restaurantItemCount: restaurantItems.length,
      phase: "capture-real-order-shape",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Wix Restaurant Inventory webhook:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
