import { NextResponse } from "next/server";
import { autopilotStatus, bootstrapAutopilot } from "@/lib/autopilot";
import { ensurePortfolioScheduled } from "@/lib/portfolio-engine";
import {
  batchRailActivationState,
  scheduleBatchRailActivation,
} from "@/lib/batchrail-activation";
import { scheduleBatchRailDistribution } from "@/lib/batchrail-distribution";
import { ensurePermitRailScheduled } from "@/lib/permitrail";
import { schedulePermitRailDistribution } from "@/lib/permitrail-distribution";
import { ensurePermitRailAcquisitionScheduled } from "@/lib/permitrail-acquisition";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function origin() {
  const explicit = process.env.PENNYRAIL_PUBLIC_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return "https://pennyrail.vercel.app";
}

async function resilientAutopilotBootstrap() {
  // A transient ntfy read failure previously looked identical to "no state" and
  // caused bootstrapAutopilot() to create a brand-new Kalshi paper window. Retry
  // status reads first and never overwrite evidence merely because the checkpoint
  // transport is momentarily unavailable. Scheduled ticks already carry fallback
  // state in their callback payload.
  let last: any = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      last = await autopilotStatus();
      if (last?.startedAt) {
        if (last.running) {
          return {
            ok: true,
            mode: last.mode,
            action: "ALREADY_RUNNING",
            startedAt: last.startedAt,
            lastTickAt: last.lastTickAt,
            nextSlot: last.nextSlot,
            scoreboard: last.scoreboard,
            kalshi: last.kalshi,
            radar: last.radar,
            gate: last?.scoreboard ? {
              paperNetRunRateUsdPerDay: last.scoreboard.paperNetRunRateUsdPerDay,
              paperRewardRunRateUsdPerDay: last.scoreboard.paperRewardRunRateUsdPerDay,
              paperTradeRunRateUsdPerDay: last.scoreboard.paperTradeRunRateUsdPerDay,
              evidence24hComplete: Boolean(last.scoreboard.paperSamples >= 100 && last.scoreboard.paperCoverage >= 0.70),
              liveCapitalReady: Boolean(last.scoreboard.liveCapitalReady),
              reason: last.scoreboard.gateReason || null,
            } : null,
            errors: Array.isArray(last.errors) ? last.errors.slice(0, 3) : [],
          };
        }
        // A successfully loaded but stale state is safe to restart;
        // bootstrapAutopilot() will load the same checkpoint and continue it.
        return await bootstrapAutopilot();
      }
    } catch {}
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300));
  }
  return {
    ok: false,
    mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61",
    action: "STATE_READ_DEFERRED",
    error: "Autopilot checkpoint could not be read reliably. Evidence was preserved rather than reset; the existing signed callback chain may repersist it on the next tick.",
  };
}

export async function GET() {
  try {
    // Bootstrap is orchestration only. Run independent checkpoint reads in
    // parallel so a slow external state transport cannot starve the 60s request.
    const [autopilotR, portfolioR, permitRailR, permitRailAcquisitionR] = await Promise.allSettled([
      resilientAutopilotBootstrap(),
      ensurePortfolioScheduled(),
      ensurePermitRailScheduled(origin()),
      ensurePermitRailAcquisitionScheduled(origin()),
    ]);

    const autopilot: any = autopilotR.status === "fulfilled"
      ? autopilotR.value
      : { ok: false, mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61", action: "STATE_READ_DEFERRED", error: autopilotR.reason instanceof Error ? autopilotR.reason.message : String(autopilotR.reason) };

    let portfolio: any;
    if (portfolioR.status === "fulfilled") {
      const scheduled: any = portfolioR.value;
      const state: any = scheduled?.state || {};
      portfolio = {
        ok: Boolean(scheduled?.ok),
        action: scheduled?.action || null,
        lastTickAt: scheduled?.lastTickAt ?? state?.lastTickAt ?? null,
        nextSlot: scheduled?.nextSlot ?? state?.nextSlot ?? null,
        money: state?.money || null,
        budget: state?.budget || null,
        scale: state?.scale ? {
          accountingVersion: state.scale.accountingVersion,
          samples: state.scale.samples,
          correctedEvidenceReset: state.scale.accountingVersion === 2,
        } : null,
        error: scheduled?.error || null,
      };
    } else {
      portfolio = { ok: false, action: "SCHEDULE_FAILED", error: portfolioR.reason instanceof Error ? portfolioR.reason.message : String(portfolioR.reason) };
    }

    const permitRail = permitRailR.status === "fulfilled"
      ? {
          ok: Boolean((permitRailR.value as any)?.ok),
          action: (permitRailR.value as any)?.action || null,
          lastRefreshAt: (permitRailR.value as any)?.state?.lastRefreshAt || null,
          nextRefreshAt: (permitRailR.value as any)?.state?.nextRefreshAt || null,
          totalSignals: Number((permitRailR.value as any)?.state?.totalSignals || 0),
          hotSignals: Number((permitRailR.value as any)?.state?.hotSignals || 0),
        }
      : { ok: false, action: "SCHEDULE_FAILED", error: permitRailR.reason instanceof Error ? permitRailR.reason.message : String(permitRailR.reason) };

    const permitRailAcquisition = permitRailAcquisitionR.status === "fulfilled"
      ? {
          ok: Boolean((permitRailAcquisitionR.value as any)?.ok),
          action: (permitRailAcquisitionR.value as any)?.action || null,
          lastRunAt: (permitRailAcquisitionR.value as any)?.state?.lastRunAt || null,
          nextRunAt: (permitRailAcquisitionR.value as any)?.state?.nextRunAt || null,
          prospectCount: Number((permitRailAcquisitionR.value as any)?.state?.prospectCount || 0),
          senderLive: Boolean((permitRailAcquisitionR.value as any)?.state?.sender?.live),
        }
      : { ok: false, action: "SCHEDULE_FAILED", error: permitRailAcquisitionR.reason instanceof Error ? permitRailAcquisitionR.reason.message : String(permitRailAcquisitionR.reason) };

    const activationTask = async () => {
      const prior = await batchRailActivationState();
      if (prior?.status === "seeded") {
        return { ok: true, activated: true, spentUsd: 0, stage: "already-seeded", seed: prior };
      }
      // Never spend when the durable budget could not be read. Free distribution
      // may continue, but the nickel waits for accounting certainty.
      if (!portfolio?.budget) {
        return { ok: false, activated: false, spentUsd: 0, stage: "budget-unavailable", error: "Portfolio budget checkpoint is temporarily unavailable; the paid activation was deferred rather than risk exceeding the experiment cap." };
      }
      const availableToday = Number(portfolio.budget.availableTodayUsd ?? 0);
      const availableWeek = Number(portfolio.budget.availableWeekUsd ?? 0);
      if (availableToday + 1e-9 < 0.05 || availableWeek + 1e-9 < 0.05) {
        return { ok: false, activated: false, spentUsd: 0, stage: "budget-blocked", error: "The one-time $0.05 BatchRail discovery seed would exceed the current experiment budget." };
      }
      const scheduled = await scheduleBatchRailActivation(origin(), 60);
      return {
        ok: true, activated: false, spentUsd: 0, stage: "scheduled", nextAttemptSlot: scheduled.slot,
        note: "The paid BatchRail activation runs in its own signed request so it cannot be killed by the bootstrap time budget.",
      };
    };

    const distributionTask = async () => {
      const distributed = await scheduleBatchRailDistribution(origin(), 90);
      return {
        ok: Boolean(distributed.ok),
        stage: distributed.alreadyDistributed ? "already-distributed" : distributed.scheduled ? "scheduled" : "ready",
        nextAttemptSlot: distributed.slot ?? null,
      };
    };

    const [activationR, distributionR, permitRailDistributionR] = await Promise.allSettled([
      activationTask(),
      distributionTask(),
      schedulePermitRailDistribution(origin(), 150),
    ]);
    const batchRailActivation = activationR.status === "fulfilled"
      ? activationR.value
      : { ok: false, activated: false, spentUsd: 0, stage: "schedule-failed", error: activationR.reason instanceof Error ? activationR.reason.message : String(activationR.reason) };
    const batchRailDistribution = distributionR.status === "fulfilled"
      ? distributionR.value
      : { ok: false, stage: "schedule-failed", error: distributionR.reason instanceof Error ? distributionR.reason.message : String(distributionR.reason) };
    const permitRailDistribution = permitRailDistributionR.status === "fulfilled"
      ? {
          ok: Boolean((permitRailDistributionR.value as any)?.ok),
          stage: (permitRailDistributionR.value as any)?.alreadyDistributed ? "already-distributed" : "scheduled",
          slot: (permitRailDistributionR.value as any)?.slot || null,
        }
      : { ok: false, stage: "schedule-failed", error: permitRailDistributionR.reason instanceof Error ? permitRailDistributionR.reason.message : String(permitRailDistributionR.reason) };

    return NextResponse.json(
      { ...autopilot, portfolio, permitRail, permitRailAcquisition, batchRailActivation, batchRailDistribution, permitRailDistribution },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, mode: "PENNYRAIL_CONSOLIDATED_AUTOPILOT_V61_PORTFOLIO_V70", error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
