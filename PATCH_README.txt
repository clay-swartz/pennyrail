PennyRail v37 TypeScript hotfix

Replace only these 9 files on the existing transaction-router-v37 branch:
  app/api/router/execute/{analyst,intel,micro,mini,nano,network,premium,skill,standard}/route.ts

Fix: explicitly types each x402 handler as Promise<NextResponse<any>> so @x402/next does not infer the success payload as the only allowed response body and reject the 400 error response at build time.

Commit suggestion:
  Fix router x402 response typing
