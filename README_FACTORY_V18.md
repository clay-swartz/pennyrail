# PennyRail Factory v18

This is the first factory build, not another marketplace diagnostic.

- Paid Factory scan buys Agent402 Demand Radar + Bestsellers (~$0.01/run).
- Radar gaps are matched automatically against 32 safe built-in micro-capabilities.
- Matching gaps are AUTO-LIVE immediately through one x402-protected endpoint: POST /api/factory/run.
- Factory runs cost $0.003 USDC each.
- Free discovery: GET /api/factory/catalog and GET /api/factory/catalog?q=<need>.
- The public x402 manifest/OpenAPI advertise the factory endpoint for machine discovery.
- Existing three PennyTools remain live.

This is an alpha factory: gaps requiring a new external data source/connector are marked NEEDS-BUILDER instead of pretending they are solved.
