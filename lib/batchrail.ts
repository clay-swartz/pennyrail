import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { createCdpFacilitatorClient } from "@coinbase/cdp-sdk/x402";
import { facilitatorUrl, mode, network, payTo } from "@/lib/x402-server";
import {
  BATCHRAIL_FULL_MAX_ITEMS, BATCHRAIL_FULL_PATH, BATCHRAIL_FULL_PRICE_USD,
  BATCHRAIL_TRIAL_MAX_ITEMS, BATCHRAIL_TRIAL_PATH, BATCHRAIL_TRIAL_PRICE_USD,
  MAX_INSTRUCTION_BYTES, MAX_LABELS,
} from "@/lib/batchrail-core";

export * from "@/lib/batchrail-core";

const customFacilitatorUrl = process.env.X402_FACILITATOR_URL?.trim();
const facilitator = mode === "mainnet" && !customFacilitatorUrl
  ? createCdpFacilitatorClient()
  : new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);

function discovery(maxItems: number, full: boolean) {
  return declareDiscoveryExtension({
    bodyType: "json",
    input: {
      labels: ["bug", "feature", "question"],
      instruction: "Classify each support message by intent.",
      items: ["Checkout fails after login", "Please add dark mode", "Where is my invoice?"],
    },
    inputSchema: {
      type: "object",
      required: ["items", "labels"],
      properties: {
        items: { type: "array", minItems: 1, maxItems, description: "Short strings, or {id,text} objects. Combined text <=32KB." },
        labels: { type: "array", minItems: 2, maxItems: MAX_LABELS, items: { type: "string" } },
        instruction: { type: "string", maxLength: MAX_INSTRUCTION_BYTES },
      },
      additionalProperties: false,
    },
    output: {
      example: {
        ok: true,
        count: 3,
        results: [
          { id: "0", label: "bug", labelIndex: 0 },
          { id: "1", label: "feature", labelIndex: 1 },
          { id: "2", label: "question", labelIndex: 2 },
        ],
        ...(full ? {} : { fullBatchResource: BATCHRAIL_FULL_PATH }),
      },
    },
  } as any);
}

export const batchRailHttpServer = new x402HTTPResourceServer(resourceServer, {
  [`POST ${BATCHRAIL_FULL_PATH}`]: {
    accepts: [{ scheme: "exact", price: `$${BATCHRAIL_FULL_PRICE_USD}`, network, payTo }],
    description: "BatchRail bulk AI classification: classify up to 1,000 short items in one x402 settlement instead of paying transaction overhead per item. Custom labels, bounded GPT-4o-mini fulfillment, hard positive-margin guard.",
    mimeType: "application/json",
    serviceName: "PennyRail BatchRail Bulk Classification",
    tags: ["AI", "batch", "classification", "inference", "bulk", "x402", "cost-savings"],
    extensions: { ...discovery(BATCHRAIL_FULL_MAX_ITEMS, true) },
  },
  [`POST ${BATCHRAIL_TRIAL_PATH}`]: {
    accepts: [{ scheme: "exact", price: `$${BATCHRAIL_TRIAL_PRICE_USD}`, network, payTo }],
    description: `BatchRail discovery/trial: classify up to 100 short items for $${BATCHRAIL_TRIAL_PRICE_USD.toFixed(2)}. Full 1,000-item bulk route is ${BATCHRAIL_FULL_PATH} for $${BATCHRAIL_FULL_PRICE_USD.toFixed(2)}.`,
    mimeType: "application/json",
    serviceName: "PennyRail BatchRail Trial",
    tags: ["AI", "batch", "classification", "inference", "bulk", "x402"],
    extensions: { ...discovery(BATCHRAIL_TRIAL_MAX_ITEMS, false) },
  },
} as any);
