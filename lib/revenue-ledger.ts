import { payTo, mode, network } from "@/lib/x402-server";
import { radarBuyerAddress } from "@/lib/radar-buyer";

const BASE_RPC = "https://mainnet.base.org";
const BASE_USDC = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const APPROX_BLOCKS_24H = 43_200;
const LOG_CHUNK = 5_000;

type RpcResponse = {
  result?: any;
  error?: { message?: string };
};

function hex(value: number) {
  return `0x${Math.max(0, Math.floor(value)).toString(16)}`;
}

function recipientTopic(address: string) {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function senderFromTopic(topic: unknown) {
  const value = String(topic || "").toLowerCase().replace(/^0x/, "");
  if (value.length < 40) return null;
  return `0x${value.slice(-40)}`;
}

async function rpc(method: string, params: any[], timeoutMs = 12_000) {
  const response = await fetch(BASE_RPC, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const body = (await response.json()) as RpcResponse;
  if (!response.ok || body?.error) {
    throw new Error(
      `Base RPC ${method} failed: ${body?.error?.message || `HTTP ${response.status}`}`,
    );
  }
  return body?.result;
}

function atomicUsdc(data: unknown) {
  try {
    return Number(BigInt(String(data || "0x0"))) / 1_000_000;
  } catch {
    return 0;
  }
}

export async function scanExternalRevenue24h() {
  const seller = String(payTo || "").trim().toLowerCase();
  const sellerReady =
    mode === "mainnet" &&
    network === "eip155:8453" &&
    /^0x[0-9a-f]{40}$/.test(seller) &&
    seller !== "0x0000000000000000000000000000000000000000";

  if (!sellerReady) {
    return {
      ok: false,
      revenueReady: false,
      reason: "seller payment rail is not valid Base-mainnet x402",
      mode,
      network,
      payToConfigured: /^0x[0-9a-f]{40}$/.test(seller),
    };
  }

  const currentHex = await rpc("eth_blockNumber", []);
  const currentBlock = Number.parseInt(String(currentHex), 16);
  if (!Number.isFinite(currentBlock)) {
    throw new Error("Base RPC returned an invalid block number");
  }

  const fromBlock = Math.max(0, currentBlock - APPROX_BLOCKS_24H);
  const chunks: Array<[number, number]> = [];
  for (let start = fromBlock; start <= currentBlock; start += LOG_CHUNK) {
    chunks.push([start, Math.min(currentBlock, start + LOG_CHUNK - 1)]);
  }

  const results = await Promise.all(
    chunks.map(async ([start, end]) => {
      try {
        const logs = await rpc("eth_getLogs", [
          {
            address: BASE_USDC,
            fromBlock: hex(start),
            toBlock: hex(end),
            topics: [TRANSFER_TOPIC, null, recipientTopic(seller)],
          },
        ]);
        return {
          ok: true,
          start,
          end,
          logs: Array.isArray(logs) ? logs : [],
          error: null as string | null,
        };
      } catch (error) {
        return {
          ok: false,
          start,
          end,
          logs: [] as any[],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const all = results.flatMap(result => result.logs);
  const failedChunks = results.filter(result => !result.ok);
  const seen = new Set<string>();
  const rows: Array<{
    txHash: string;
    logIndex: string;
    sender: string | null;
    amountUsd: number;
    blockNumber: number | null;
  }> = [];

  for (const log of all) {
    const txHash = String(log?.transactionHash || "");
    const logIndex = String(log?.logIndex || "");
    const key = `${txHash}:${logIndex}`;
    if (!txHash || seen.has(key)) continue;
    seen.add(key);

    rows.push({
      txHash,
      logIndex,
      sender: senderFromTopic(log?.topics?.[1]),
      amountUsd: atomicUsdc(log?.data),
      blockNumber: log?.blockNumber
        ? Number.parseInt(String(log.blockNumber), 16)
        : null,
    });
  }

  let internalBuyer: string | null = null;
  try {
    internalBuyer = String(await radarBuyerAddress()).toLowerCase();
  } catch {}

  const external = rows.filter(
    row =>
      row.amountUsd > 0 &&
      (!internalBuyer || row.sender?.toLowerCase() !== internalBuyer),
  );
  const internal = rows.filter(
    row =>
      row.amountUsd > 0 &&
      Boolean(internalBuyer) &&
      row.sender?.toLowerCase() === internalBuyer,
  );

  const totalExternalUsd = external.reduce((sum, row) => sum + row.amountUsd, 0);
  const totalInternalUsd = internal.reduce((sum, row) => sum + row.amountUsd, 0);
  const externalPayers = new Set(
    external.map(row => row.sender).filter((value): value is string => Boolean(value)),
  );

  return {
    ok: true,
    revenueReady: true,
    generatedAt: new Date().toISOString(),
    window: {
      approximateHours: 24,
      fromBlock,
      toBlock: currentBlock,
      blockCount: currentBlock - fromBlock + 1,
      scanChunks: results.length,
      failedChunks: failedChunks.length,
      complete: failedChunks.length === 0,
      errors: failedChunks.slice(0, 3).map(row => ({
        fromBlock: row.start,
        toBlock: row.end,
        error: row.error,
      })),
      note:
        "Base targets ~2-second blocks; this uses the latest 43,200 blocks as an approximately 24-hour window. If a chunk fails, totals are explicitly marked partial rather than silently presented as complete.",
    },
    seller,
    internalBuyer,
    external: {
      usdcUsd: Number(totalExternalUsd.toFixed(6)),
      transferCount: external.length,
      uniquePayers: externalPayers.size,
      transfers: external.slice(-50),
    },
    internalBootstrap: {
      usdcUsd: Number(totalInternalUsd.toFixed(6)),
      transferCount: internal.length,
      excludedFromRevenue: true,
    },
    caveat:
      "This is outside USDC inflow to the PennyRail seller wallet, not a claim that every transfer came from an x402 product. Internal buyer-wallet transfers are explicitly excluded.",
  };
}
