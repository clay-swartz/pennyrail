PennyRail v38.3 — x402 List verification hotfix

Changed/new project files:
  app/api/radar/x402-list/route.ts
  app/r/7f2d4c/page.tsx

Purpose:
- Show PennyRail's live x402 List status directly in Radar.
- Add one-click paid x402 List delivery verification with a hard $0.30 ceiling.
- Clearly distinguish a directory verification settlement from organic customer revenue.
- Refresh stale Radar copy now that x402 List and the official MCP Registry are live.

Suggested branch:
  x402-list-verify-v38-3

Suggested commit:
  Add x402 List verification to Radar

After Production is green:
1. Open Radar.
2. Click "Check x402 List".
3. If Payment-ready = YES and Verified = NO, click "Verify delivery · max $0.30".
4. Paste the returned JSON into ChatGPT.
