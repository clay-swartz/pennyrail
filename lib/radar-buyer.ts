import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

export function paidFetch() {
  const key = process.env.RADAR_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!key) throw new Error("RADAR_BUYER_PRIVATE_KEY is not configured");
  const signer = privateKeyToAccount(key);
  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(signer));
  return wrapFetchWithPayment(fetch, client);
}
