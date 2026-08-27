import { CdpClient } from "@coinbase/cdp-sdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const BUYER_ACCOUNT_NAME = "pennyrail-radar-buyer";

let cdpClient: CdpClient | null = null;
let cachedAccount: Promise<any> | null = null;
let cachedPaidFetch: Promise<typeof fetch> | null = null;

function getCdpClient() {
  if (!cdpClient) cdpClient = new CdpClient();
  return cdpClient;
}

async function buyerAccount() {
  if (!cachedAccount) {
    cachedAccount = getCdpClient().evm.getOrCreateAccount({ name: BUYER_ACCOUNT_NAME });
  }
  return cachedAccount;
}

async function buildPaidFetch() {
  const account = await buyerAccount();

  // Coinbase's managed EVM server account already implements the x402 signer
  // capabilities we need (address + signTypedData). Keep custody and signing
  // inside CDP; never export the private key into PennyRail or Vercel memory.
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
