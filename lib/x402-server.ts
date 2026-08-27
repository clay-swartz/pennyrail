import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

export const payTo = process.env.PENNYRAIL_PAY_TO || "0x0000000000000000000000000000000000000000";
export const mode = process.env.X402_MODE === "mainnet" ? "mainnet" : "testnet";
export const network = mode === "mainnet" ? "eip155:8453" : "eip155:84532";
export const facilitatorUrl = process.env.X402_FACILITATOR_URL ||
  (mode === "mainnet" ? "https://api.cdp.coinbase.com/platform/v2/x402" : "https://x402.org/facilitator");

const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
export const x402Server = new x402ResourceServer(facilitator);
x402Server.register("eip155:*", new ExactEvmScheme());

export const penny = (description: string, price = "$0.001") => ({
  accepts: [{ scheme: "exact", price, network, payTo }],
  description,
  mimeType: "application/json",
});
