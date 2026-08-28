# PennyRail Distribution v27

Full-project build based on v26.

true402 fixes:
- `pricing.base` is now a string, matching true402's documented schema.
- The true402 service manifest is reduced to its documented minimal shape.
- true402 now points to PennyRail's generic `/api/factory/run` service, which
  is actually priced at `$0.003` per call.
- Agent402 remains unchanged and continues indexing the individual `$0.001`
  PennyRail tollbooths.
