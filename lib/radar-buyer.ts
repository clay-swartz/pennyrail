import { CdpClient } from "@coinbase/cdp-sdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

export const BUYER_ACCOUNT_NAME = "pennyrail-radar-buyer";

let cdpClient: CdpClient | null = null;
let cachedAccount: Promise<any> | null = null;
let cachedPaidFetch: Promise<typeof fetch> | null = null;

function env(name: string) {
  return process.env[name]?.trim();
}

export function getCdpClient() {
  if (!cdpClient) {
    cdpClient = new CdpClient({
      apiKeyId: env("CDP_API_KEY_ID"),
      apiKeySecret: env("CDP_API_KEY_SECRET"),
      walletSecret: env("CDP_WALLET_SECRET"),
    });
  }
  return cdpClient;
}

export async function buyerAccount() {
  if (!cachedAccount) {
    cachedAccount = getCdpClient().evm.getOrCreateAccount({ name: BUYER_ACCOUNT_NAME });
  }
  return cachedAccount;
}

async function buildPaidFetch() {
  const account = await buyerAccount();

  // Coinbase's managed EVM server account implements the signer capabilities
  // x402 needs. Keep custody/signing inside CDP; never export the private key.
  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(account as any));

  return wrapFetchWithPayment(globalThis.fetch, client);
}

export async function paidFetch() {
  if (!cachedPaidFetch) cachedPaidFetch = buildPaidFetch();
  return cachedPaidFetch;
}

export async function radarBuyerAddress() {
  const account = await buyerAccount();
  return account.address as `0x${string}`;
}

export async function fundRadarBuyerTestUsdc() {
  const account = await buyerAccount();
  const { transactionHash } = await account.requestFaucet({
    network: "base-sepolia",
    token: "usdc",
  });
  return { address: account.address as `0x${string}`, transactionHash };
}
