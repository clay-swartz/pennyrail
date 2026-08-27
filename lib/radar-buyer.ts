import { CdpX402Client } from "@coinbase/cdp-sdk/x402";
import { wrapFetchWithPayment } from "@x402/fetch";

let client: CdpX402Client | null = null;

export function getRadarBuyerClient() {
  if (!client) {
    client = new CdpX402Client({ environment: "development" });
  }
  return client;
}

export function paidFetch() {
  return wrapFetchWithPayment(globalThis.fetch, getRadarBuyerClient());
}

export async function radarBuyerAddresses() {
  return getRadarBuyerClient().getAddresses();
}
