# PennyRail v8 — self-test response fix

Fixes the self-test route reading the same Fetch Response body twice.

Changes:
- Reads the protected endpoint response exactly once with `response.text()`.
- Parses the saved text as JSON when possible.
- Preserves raw text when the response is not JSON.
- Returns HTTP status/content type and whether an x402 payment-response header is present.

No Coinbase/Vercel credential changes are required.
