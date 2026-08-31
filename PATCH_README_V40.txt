PennyRail v40 Revenue Acquisition Patch

Purpose
-------
Reduce buyer friction and create a direct agent-readable acquisition entrypoint.
This patch DOES NOT add random inventory and DOES NOT change the safe isolated Bazaar architecture.

Files
-----
SKILL.md
public/SKILL.md
public/llms.txt

Why
---
PennyRail's MCP server currently performs discovery and quoting, then instructs the buyer to
pay/call the returned HTTP x402 executeUrl. This patch gives agent runtimes a concise,
self-contained playbook for that purchase journey and a machine-readable web entrypoint.

Workflow
--------
1. Create a new branch from current main.
2. Upload this patch ZIP preserving paths.
3. Open PR.
4. Merge only after Production/Vercel is green.
5. Validate:
   https://pennyrail.vercel.app/SKILL.md
   https://pennyrail.vercel.app/llms.txt

Do not alter the existing isolated /api/bazaar/web-search architecture.
