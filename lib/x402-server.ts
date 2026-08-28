import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";

export const payTo = process.env.PENNYRAIL_PAY_TO || "0x0000000000000000000000000000000000000000";
export const mode = process.env.X402_MODE === "mainnet" ? "mainnet" : "testnet";
export const network: `${string}:${string}` = mode === "mainnet" ? "eip155:8453" : "eip155:84532";
export const facilitatorUrl = process.env.X402_FACILITATOR_URL ||
  (mode === "mainnet" ? "https://api.cdp.coinbase.com/platform/v2/x402" : "https://x402.org/facilitator");

function makeResourceServer() {
  const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
  const server = new x402ResourceServer(facilitator);
  server.register("eip155:*", new ExactEvmScheme());
  return server;
}

export const x402Server = makeResourceServer();

// Separate server for protocol-level Bazaar discovery. Keeping this isolated
// means the original three PennyTools continue using the already-proven
// withX402 path, while factory routes can use exact route maps (not wildcard).
export const x402BazaarServer = makeResourceServer();
x402BazaarServer.registerExtension(bazaarResourceServerExtension);

export const penny = (description: string, price = "$0.001") => ({
  accepts: [{ scheme: "exact", price, network, payTo }],
  description,
  mimeType: "application/json",
});
