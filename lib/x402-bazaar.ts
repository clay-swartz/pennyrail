import { HTTPFacilitatorClient, x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension, declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { facilitatorUrl, network, payTo } from "@/lib/x402-server";

const facilitator = new HTTPFacilitatorClient({ url: facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());
resourceServer.registerExtension(bazaarResourceServerExtension);

export const BAZAAR_PROBE_PATH = "/api/bazaar-probe";

const discovery = declareDiscoveryExtension({
  input: {},
  inputSchema: { properties: {}, required: [] },
  output: {
    example: {
      ok: true,
      service: "PennyRail Bazaar probe",
    },
  },
});

export const bazaarProbeHttpServer = new x402HTTPResourceServer(resourceServer, {
  [`GET ${BAZAAR_PROBE_PATH}`]: {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network,
      payTo,
    }],
    description: "PennyRail protocol discovery probe.",
    mimeType: "application/json",
    extensions: { ...discovery },
  },
});
