PennyRail v42.1 TypeScript Hotfix

Build failure fixed:
TS7023 / TS7024 in lib/gap-arbitrage-primitives.ts

Cause:
Recursive helper `typeMatches` lacked an explicit boolean return type, and the callback
inside Array.some() inherited the recursive implicit-any inference problem.

Fix:
- `typeMatches(...): boolean`
- callback explicitly returns boolean

No behavior, pricing, routing, metadata, payment, Bazaar, or revenue logic changed.

EXACT WORKFLOW
==============
Do NOT create a new branch if v42-paid-gap-arbitrage PR is still open.

On the existing branch:
v42-paid-gap-arbitrage

Upload this ZIP preserving path.

Commit as:
Fix v42 TypeScript recursive type check

Keep the existing PR title:
v42: Convert paid market gaps into PennyRail revenue

Wait for Vercel to rebuild.
Report:
green
OR paste the next exact build error.
