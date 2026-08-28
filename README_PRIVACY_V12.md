# PennyRail v12 — quiet public surface

- Public `/` is now a sparse machine/service index rather than the operator dashboard.
- Operator Radar UI moved to `/r/7f2d4c` and is intentionally not linked from `/`.
- Radar API actions remain protected by `RADAR_ADMIN_TOKEN`; the obscure path is not treated as authentication.
- HTML pages are marked `noindex` via Next metadata.
- No blanket `robots.txt` deny rule is used, because x402 marketplace crawlers may honor robots directives and need access to discovery surfaces.
- `/.well-known/x402` and `/openapi.json` remain public and machine-readable.
