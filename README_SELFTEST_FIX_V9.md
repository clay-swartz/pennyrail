# PennyRail Self-Test v9 — public production URL fix

The v8 self-test reached a Vercel Deployment Protection / SSO login page instead of PennyRail's x402-protected API route. Because the login page returned HTTP 200, the old self-test mistakenly reported success.

v9 changes:

- Uses `PENNYRAIL_PUBLIC_URL` when explicitly configured.
- Otherwise uses Vercel's built-in `VERCEL_PROJECT_PRODUCTION_URL`.
- Falls back to the incoming request origin only when neither is available.
- Detects Vercel SSO/login HTML and returns a targeted error.
- Requires the expected `text-stats` JSON shape before reporting success.
- Reports target origin, final response URL, HTTP status, content type, and x402 payment-response header presence.

No Coinbase credentials or wallet changes are required.
