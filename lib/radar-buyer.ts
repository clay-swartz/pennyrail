import { CdpClient } from "@coinbase/cdp-sdk";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

export const BUYER_ACCOUNT_NAME = "pennyrail-radar-buyer";
export const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

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

function requirementAmount(requirement: any) {
  const raw = requirement?.amount ?? requirement?.maxAmountRequired ?? "0";
  try { return BigInt(String(raw)); } catch { return 0n; }
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

/**
 * Build a one-purpose Base-USDC x402 client with a hard per-payment ceiling.
 * This is used for autonomous market-intelligence purchases so a changed
 * upstream quote can never silently turn a penny-scale scan into a large spend.
 */
export async function paidFetchBaseUsdcCapped(maxUsd: number) {
  if (!Number.isFinite(maxUsd) || maxUsd <= 0 || maxUsd > 5) {
    throw new Error("maxUsd must be > 0 and <= 5");
  }
  const maxAtomic = BigInt(Math.round(maxUsd * 1_000_000));
  const account = await buyerAccount();
  const client = new x402Client((_version, requirements) => {
    const safe = requirements
      .filter((r: any) => {
        const requested = requirementAmount(r);
        return String(r?.scheme || "") === "exact" &&
          String(r?.network || "") === "eip155:8453" &&
          String(r?.asset || "").toLowerCase() === BASE_USDC &&
          requested > 0n && requested <= maxAtomic;
      })
      .sort((a: any, b: any) => Number(requirementAmount(a) - requirementAmount(b)));
    if (!safe.length) {
      throw new Error(`No Base-USDC x402 option fits the approved $${maxUsd.toFixed(3)} ceiling.`);
    }
    return safe[0];
  });
  client.register("eip155:*", new ExactEvmScheme(account as any));
  return wrapFetchWithPayment(globalThis.fetch, client);
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
