import { NextRequest, NextResponse } from "next/server";
import { isRadarAdmin } from "@/lib/radar-auth";
import { paidFetchBaseUsdcCapped } from "@/lib/radar-buyer";

export const dynamic = "force-dynamic";

const SOURCE = "https://www.x402scan.com/api/x402/merchants";
const LOOKBACK_DAYS = 1;
const PAGE_SIZE = 50;
const PAYMENT_CEILING_USD = 0.011;
const USDC_ATOMIC = 1_000_000;

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function body(response: Response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; }
  catch { return { raw: text.slice(0, 1000) }; }
}

function address(value: unknown) {
  return String(value || "").trim();
}

export async function GET(req: NextRequest) {
  if (!isRadarAdmin(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(SOURCE);
    url.searchParams.set("timeframe", String(LOOKBACK_DAYS));
    url.searchParams.set("chain", "base");
    url.searchParams.set("sort_by", "volume");
    url.searchParams.set("page", "0");
    url.searchParams.set("page_size", String(PAGE_SIZE));

    // x402scan prices this query at $0.01. The client rejects any changed
    // payment requirement above the explicit $0.011 Base-USDC ceiling.
    const paidFetch = await paidFetchBaseUsdcCapped(PAYMENT_CEILING_USD);
    const response = await paidFetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    const payload = await body(response);

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        source: SOURCE,
        error: `x402scan merchant query HTTP ${response.status}`,
        paidUsdMax: PAYMENT_CEILING_USD,
        response: payload,
      }, { status: 502 });
    }

    const rawRows = Array.isArray(payload?.data) ? payload.data : [];
    const merchants = rawRows.map((row: any) => {
      // x402scan stores USDC in 6-decimal atomic units. Convert exactly once.
      const grossUsd24h = n(row?.total_amount) / USDC_ATOMIC;
      const transactions24h = Math.max(0, Math.trunc(n(row?.tx_count)));
      const uniqueBuyers24h = Math.max(0, Math.trunc(n(row?.unique_buyers)));
      const averageTicketUsd = transactions24h ? grossUsd24h / transactions24h : 0;
      const transactionsPerBuyer = uniqueBuyers24h ? transactions24h / uniqueBuyers24h : 0;
      const recipient = address(row?.recipient);
      const flags: string[] = [];

      if (uniqueBuyers24h < 3) flags.push("LOW_BUYER_COUNT");
      if (transactions24h < 20) flags.push("LOW_TRANSACTION_COUNT");
      if (transactionsPerBuyer < 2) flags.push("LOW_REPEAT_USAGE");
      if (averageTicketUsd > 100 && transactions24h < 10) flags.push("LUMPY_HIGH_TICKET_FLOW");
      if (!recipient) flags.push("MISSING_RECIPIENT");

      // This is deliberately strict: passing means the address shows both
      // meaningful revenue and repeated multi-buyer activity. It is market
      // proof, not proof that PennyRail can copy the underlying product.
      const demandQualified =
        grossUsd24h >= 100 &&
        uniqueBuyers24h >= 3 &&
        transactions24h >= 20 &&
        transactionsPerBuyer >= 2;

      return {
        recipient,
        grossUsd24h,
        transactions24h,
        uniqueBuyers24h,
        averageTicketUsd,
        transactionsPerBuyer,
        latestSettlementAt: row?.latest_block_timestamp ?? null,
        chains: Array.isArray(row?.chains) ? row.chains : [],
        facilitatorIds: Array.isArray(row?.facilitator_ids) ? row.facilitator_ids : [],
        demandQualified,
        flags,
        explorer: recipient ? `https://www.x402scan.com/recipient/${recipient}` : null,
      };
    }).sort((a: any, b: any) => b.grossUsd24h - a.grossUsd24h);

    const sampledGrossUsd24h = merchants.reduce((sum: number, row: any) => sum + row.grossUsd24h, 0);
    const topGrossUsd24h = merchants[0]?.grossUsd24h || 0;
    const qualified = merchants.filter((row: any) => row.demandQualified);
    const targetProof = qualified.some((row: any) => row.grossUsd24h >= 1_000);

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      model: "x402scan observed Base-USDC recipient flow radar",
      source: {
        name: "x402scan merchant leaderboard",
        url: SOURCE,
        lookbackDays: LOOKBACK_DAYS,
        requestedRows: PAGE_SIZE,
        returnedRows: merchants.length,
        paidUsdMax: PAYMENT_CEILING_USD,
      },
      accounting: {
        rawAmountUnit: "USDC atomic units",
        atomicUnitsPerUsd: USDC_ATOMIC,
        conversion: "grossUsd24h = total_amount / 1,000,000",
        netRevenue: false,
        attribution: "recipient wallet only; underlying resource must be resolved separately",
        caveat: "Observed settlement flow can include transfers that are not repeatable product demand. Multi-buyer and repeat-usage gates reduce, but do not eliminate, that risk.",
      },
      gate: {
        target: "$1,000/day NET to PennyRail",
        observedRecipientAtOrAbove1000Gross24h: targetProof,
        cloneReady: false,
        qualifiedRecipientCount: qualified.length,
        topRecipientGrossUsd24h: topGrossUsd24h,
        sampledTop50GrossUsd24h: sampledGrossUsd24h,
        nextAction: qualified.length
          ? "RESOLVE_TOP_QUALIFIED_RECIPIENT_TO_EXACT_PAID_RESOURCE"
          : "DEMOTE_X402_AND_SCAN_NEXT_DIRECT_PAYER_LANE",
      },
      qualified: qualified.slice(0, 15),
      merchants,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: SOURCE,
      paidUsdMax: PAYMENT_CEILING_USD,
      error: error instanceof Error ? error.message : "x402 paid-flow scan failed",
    }, { status: 500 });
  }
}
