PennyRail v52 — MONEY + PAIN RADAR

Goal
- One scoreboard only: net revenue/day, target >= $1,000/day.
- Preserve proven-demand cloning/undercutting.
- Restore unmet-demand gap arbitrage as an equal first-class lane.

What this patch does
1. Adds Agentery public-MCP demand radar.
   - Calls tools/list dynamically, then demand_signals + market_gaps when available.
   - Extracts observed demand phrases.
   - Classifies which already map to PennyRail and which are unresolved gaps.
   - No auth and no paid intelligence required.

2. Turns the402 open requests into a true gap market.
   - Existing deterministic PennyRail capability gets first chance to bid.
   - If no current primitive matches, safe digital work can fall through to a bounded AI gap executor.
   - General executor is listed automatically as "PennyRail Agent Gap Executor" at $0.75 fixed price.
   - Open-request bids use a $0.75 floor, 25% of posted budget, and a $5 cap; never above the request budget.
   - Unverified-provider ceiling remains $25.

3. Autonomous fulfillment.
   - Won gap jobs execute through the existing v51 runOpenAiAgentExecution path.
   - At most one built-in tool call through that executor.
   - Web or code execution is selected only when the task wording indicates it is needed.
   - High-risk, credentialed, financial-execution and physical-world tasks are rejected.

4. Cron becomes Money + Pain Radar.
   - Existing revenue audit stays intact.
   - Existing Agent402 republish stays intact.
   - the402 sweep now reports exact-capability bids vs gap bids.
   - Agentery pain scan is cached for six hours because its underlying market is refreshed daily.

Why this matters
Previously PennyRail watched paid requests but discarded requests it could not already map to a prebuilt primitive. v52 treats that failure as demand. A request can now become revenue first, and a dedicated primitive can be built later only if repeated demand proves it deserves one.

Files
- lib/agentery-pain.ts (new)
- lib/gap-bidder.ts (new)
- app/api/the402/webhook/route.ts (replace)
- app/api/revenue/cron/route.ts (replace)
