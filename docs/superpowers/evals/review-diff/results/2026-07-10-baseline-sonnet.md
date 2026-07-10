# Baseline — code-reviewer (sonnet), effort standard, 2026-07-10

Runner: parent session (Fable), protocol per `../README.md`. Fixture base
d343489 (= the harness commit's parent for src files; all patches applied and
reverted cleanly). fx-05 ran as a FULL review (no prior report) — it is the
comparison point for Phase 2 delta mode.

| fixture | found | missed | FP | tokens | wall time |
|---|---|---|---|---|---|
| fx-01 (logic/boundary) | 1/1 | 0 | 0 | 34,755 | 57s |
| fx-02 (type escape) | 1/1 | 0 | 0 | 41,842 | 144s |
| fx-03 (render purity) | 1/1 | 0 | 0 | 40,478 | 59s |
| fx-04 (swallowed error) | 1/1 | 0 | 0 | 38,149 | 74s |
| fx-05 (delta seed, run FULL) | 1/1 | 0 | 0 | 43,035 | 96s |
| **total** | **5/5** | **0** | **0** | **198,259** | **430s** |

## Notes

- Every core finding came back CONFIRMED by the verifier child with the
  correct rule citation where applicable (AGENTS.md type-escape for fx-02,
  react.md Idempotent for fx-03, design.md Content States for fx-04).
- fx-05 produced one additional CONFIRMED finding (the seeded max change
  breaks the existing 51-char boundary test; the reviewer ran vitest to prove
  it) — scored as the acceptable extra declared in `fx-05/expected.md`
  (test/boundary mismatch), not a false positive.
- Verifiers independently re-derived failure paths (fx-01: server fn →
  gateway; fx-02: tsc on HEAD via stash round-trip; fx-04: both no-throw
  failure modes), i.e. verification quality, not just detection, is at
  ceiling on these fixtures.
- Sonnet at effort standard saturates this fixture set (5/5, 0 FP). The set
  therefore measures **regression** (a cheaper model or a skill change must
  not drop below 5/5) rather than headroom; if a future model change needs
  discrimination, add harder fixtures rather than re-weighting these.
- Dispatch prompts were deliberately minimal ("Review the uncommitted diff
  in <repo>") to avoid steering; per-fixture context was NOT given.
