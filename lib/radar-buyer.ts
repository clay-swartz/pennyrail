import { CdpClient } from "@coinbase/cdp-sdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const BUYER_ACCOUNT_NAME = "pennyrail-radar-buyer";

let cdpClient: CdpClient | null = null;
let cachedBuyer: Promise<{ address: `0x${string}`; paidFetch: typeof fetch }> | null = null;

function getCdpClient() {
  if (!cdpClient) cdpClient = new CdpClient();
  return cdpClient;
}

async function buildBuyer() {
  const cdp = getCdpClient();
  const account = await cdp.evm.getOrCreateAccount({ name: BUYER_ACCOUNT_NAME });

  // Testnet MVP compatibility bridge:
  // Coinbase's CdpX402Client currently pulls SVM modules into the Next.js bundle.
  // Export the named EVM key only into server memory so the standard EVM-only
  // x402 client can sign. Never log or return this key.
  const privateKey = await cdp.evm.exportAccount({ name: BUYER_ACCOUNT_NAME });
  const signer = privateKeyToAccount(privateKey as `0x${string}`);

  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(signer));

  return {
    address: account.address as `0x${string}`,
    paidFetch: wrapFetchWithPayment(globalThis.fetch, client),
  };
}

async function buyer() {
  if (!cachedBuyer) cachedBuyer = buildBuyer();
  return cachedBuyer;
}

export async function paidFetch() {
  return (await buyer()).paidFetch;
}

export async function radarBuyerAddress() {
  return (await buyer()).address;
}

export async function fundRadarBuyerTestUsdc() {
  const address = await radarBuyerAddress();
  const { transactionHash } = await getCdpClient().evm.requestFaucet({
    address,
    network: "base-sepolia",
    token: "usdc",
  });
  return { address, transactionHash };
}
