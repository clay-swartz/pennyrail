import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";

export const payTo = process.env.PENNYRAIL_PAY_TO || "0x0000000000000000000000000000000000000000";
export const mode = process.env.X402_MODE === "mainnet" ? "mainnet" : "testnet";
export const network: `${string}:${string}` = mode === "mainnet" ? "eip155:8453" : "eip155:84532";

const customFacilitatorUrl = process.env.X402_FACILITATOR_URL?.trim();
export const facilitatorUrl = customFacilitatorUrl ||
  (mode === "mainnet" ? "https://api.cdp.coinbase.com/platform/v2/x402" : "https://x402.org/facilitator");

// Coinbase's hosted Base-mainnet facilitator requires CDP authentication.
// Use the CDP SDK's authenticated drop-in facilitator client when PennyRail is
// on mainnet and no custom facilitator override has been configured. Testnet
// and explicit custom facilitators keep the existing plain HTTP behavior.
const facilitator = mode === "mainnet" && !customFacilitatorUrl
  ? createCdpFacilitatorClient()
  : new HTTPFacilitatorClient({ url: facilitatorUrl });

export const x402Server = new x402ResourceServer(facilitator);
x402Server.register("eip155:*", new ExactEvmScheme());

type ResourceMetadata = {
  serviceName?: string;
  tags?: string[];
};

export const penny = (
  description: string,
  price = "$0.001",
  metadata?: ResourceMetadata,
) => ({
  accepts: [{ scheme: "exact", price, network, payTo }],
  description,
  mimeType: "application/json",
  ...(metadata?.serviceName ? { serviceName: metadata.serviceName } : {}),
  ...(metadata?.tags?.length ? { tags: metadata.tags } : {}),
});
