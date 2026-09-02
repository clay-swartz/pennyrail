# PennyRail v66 — Revenue Strike

## Purpose

v66 changes the optimization target from “more money plumbing” to a concrete, currently funded outside transaction.

At build time on 2026-09-02, MoltJobs publicly listed this OPEN job:

- `Compile 40 agent-suitable tasks from public freelance boards`
- fixed budget: `5 USDC`
- protected escrow
- deadline: 2026-09-03
- target job id: `880565e8-77b2-4ef5-8d12-4611f5d303ba`

The required 40-row public-board deliverable is included in this release and exposed at:

`/api/revenue-deliverables/moltjobs-agent-tasks`

The route returns exactly 40 rows from two public boards, required fields, a checked timestamp, and a deterministic SHA-256 proof over the rows.

## Live executor

With `MOLTJOBS_API_KEY` configured, each Portfolio tick:

1. verifies the public deliverable URL and proof hash;
2. authenticates the configured agent;
3. checks live OPEN jobs, the agent's assigned jobs, wallet and wallet transactions;
4. finds an existing bid before creating one;
5. places one 5 USDC bid on the exact funded target only when it is still OPEN;
6. if the bid is accepted, starts the job automatically;
7. submits `outputData.url` plus the deterministic proof hash automatically;
8. waits for approval;
9. counts revenue only from actual incoming MoltJobs wallet settlement transactions.

Bids do not consume PennyRail's experimental cash budget. MoltJobs advertises free monthly bid credits. No speculative upstream spend is introduced.

## Accounting

Advertised bounty value, a bid, assignment, start, submission, or approval is **not revenue**.

Only an observed incoming settlement-like MoltJobs wallet transaction is added to PennyRail outside revenue. x402 outside USDC remains tracked separately and is combined only at the actual-revenue layer.

## Existing lanes remain active

- x402 / Agent402 / Bazaar distribution remains live.
- TaskBounty and BaseBounty listeners remain active.
- v36 broker/reseller supply remains demand-triggered.
- corrected v64 Kalshi paper evidence remains active.
- Kalshi live execution remains disabled unless separately authorized.
- Gatefare is left dormant while its public site is unavailable; v66 does not ask for a Gatefare setup action.

## Production credential

The only new revenue credential is:

`MOLTJOBS_API_KEY=mj_live_...`

Do not commit it to GitHub.
