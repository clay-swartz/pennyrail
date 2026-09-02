# PennyRail v68 — Corrected Scale Gate + Live Distribution

Objective remains unchanged: **$1,000/day NET in mostly autonomous/background revenue.**

This release fixes two production blockers exposed by the 2026-09-02 live bootstrap and corrects contaminated Polymarket v67 evidence. It also adds free direct distribution of BatchRail to two live x402 buyer-discovery surfaces.

## 1. Bootstrap no longer tries to do everything inside one 60-second request

v67 synchronously combined:

- autopilot work;
- Portfolio work;
- a paid x402 BatchRail self-call;
- external scans/persistence.

A network delay caused the whole bootstrap to report generic `fetch failed`/timeout errors.

v68 changes bootstrap to orchestration only:

- reads existing autopilot state first;
- schedules Portfolio execution separately;
- schedules the one-time BatchRail paid activation in its own signed callback;
- schedules free BatchRail distribution in its own signed callback.

The paid activation can no longer consume the parent bootstrap's time budget.

## 2. Do not reset Kalshi paper evidence on a transient checkpoint read

The last live bootstrap re-created the autopilot paper window because an ntfy read failure looked like “no prior state.” v68 bootstrap now retries status reads and, if the existing checkpoint cannot be read reliably, **defers rather than overwriting it with a blank window**. Normal signed scheduled callbacks already carry fallback state.

The already-lost v64 paper hours cannot be reconstructed and are not fabricated.

## 3. BatchRail activation uses the nickel already funded

The one-time x402 seed remains hard-capped at **$0.05** and remains excluded from outside revenue.

v68 schedules `/api/batch/activate` separately with an HMAC-signed callback. The route supports scheduler GET or POST delivery.

No additional user funding is requested by this release.

## 4. BatchRail gets direct buyer distribution, not just a product endpoint

v68 adds a separate signed distribution worker that registers PennyRail/BatchRail with:

- **Agent402** — origin registration for its open x402 index/router;
- **x402dash** — direct registration of `/api/batch/trial` and `/api/batch/classify`.

Registration is free and requires no account/API key. A small durable marker prevents successful distribution from being repeated on every bootstrap.

`GET /api/batch/status` exposes only non-secret operational state so production activation/distribution can be checked without another deployment.

## 5. Polymarket v67 reward accounting is invalidated and corrected

v67 treated `rewardPool` returned with each market as if every market had an independent pool. Polymarket's published semantics say the reward pool is **shared across a program's markets**, so the same program pool must never be summed once per market.

v68:

- groups market rows by `programId + start + end + period`;
- counts the pool **once per shared program/time period**;
- tracks the number of markets sharing that pool;
- samples live books from up to four markets/program;
- screens cheap-side target capital and visible best-level competition;
- reports an equal-side program-share gross yardstick and estimated capital required to screen for $1,000 **gross** reward/day;
- never labels that screening figure NET profit;
- keeps live Polymarket execution disabled.

All v67 Polymarket Scale Gate samples are automatically discarded on migration. Revenue, spend and other Portfolio history are preserved.

## 6. Suspended 402radar is removed from the Foundry dependency chain

The Foundry no longer depends on `api.402radar.io`, which is currently suspended. Machine-commerce products use direct PennyRail settlement evidence and live marketplace/distribution surfaces instead.

## Capital safety remains unchanged

Polymarket live execution remains behind:

- `POLYMARKET_US_LIVE=false` by default;
- credentials absent by default;
- positive explicit capital cap required;
- kill-switch support;
- **no capital authorization from public reward-pool screening alone**.

Kalshi remains corrected-paper only unless its separate evidence gate and explicit human authorization clear.

## Validation completed

- strict targeted TypeScript no-emit check across all v68 changed modules/routes: **PASS**
- corrected Polymarket mocked runtime:
  - duplicate market rows for one shared reward program count the pool once: **PASS**
  - program/time-period count: **PASS**
  - market count: **PASS**
  - book sampling: **PASS**
  - live mode disabled by default: **PASS**
- v67 → v68 migration runtime:
  - real money history preserved: **PASS**
  - contaminated Polymarket evidence reset: **PASS**
  - missing checkpoint defers rather than schedules/persists a blank state: **PASS**
- BatchRail activation scheduler:
  - signed isolated callback: **PASS**
  - token verification: **PASS**
- BatchRail distribution runtime:
  - Agent402 registration: **PASS**
  - x402dash trial registration: **PASS**
  - x402dash full registration: **PASS**
  - signed scheduler callback: **PASS**
- bootstrap runtime:
  - running autopilot does not call reset/bootstrap path: **PASS**
  - Portfolio only schedules/statuses work inline: **PASS**
  - BatchRail paid activation is scheduled, not executed inline: **PASS**
  - free distribution is scheduled: **PASS**

## Deployment

Branch: `v68-corrected-scale-live-distribution`

Commit as: `Correct PennyRail scale economics and unblock live distribution`

PR title: `Correct PennyRail scale economics and unblock live distribution`
