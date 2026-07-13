# Flat spec pipeline (ADR-0015) — spec-verifier hunter + spec-checker, 2026-07-12

First scored run of the flat spec-verification pipeline and the first run ever
for the sx-01 fixture. Protocol per `../README.md` (hunter dispatch →
checker dispatch with the machine + candidates → score off the checker's
CONFIRMED survivors). Runner: parent session (Fable); both agents opus.
2 dispatches (hunter + checker), **zero hangs**.

## fx / sx result

| fixture | expected | result | tokens (hunter+checker) | wall time |
|---|---|---|---|---|
| sx-01 (two-step wizard, double-submit loophole) | double-submit counterexample found, CONFIRMED | **found** — F1 (forbidden) + I1 (invariant) CONFIRMED on the 4-step trace `edit --next--> review --confirm--> done --back--> review --confirm--> done`; **0 false positives** | 47.5k | 98s |

## Detail

- **Hunter** formalized the 3-state machine cleanly, flagged 4 ambiguities
  (the two critical ones — unguarded `confirm`, `back`-from-`done` — being the
  loophole's mechanism), and produced 3 candidate counterexamples: the
  double-submit trace under both the forbidden-flow (F1) and invariant (I1)
  lenses, plus a liveness/no-terminal-state candidate.
- **Checker** (fresh, hunt-blind) replayed all three: CONFIRMED F1 and I1
  (same trace, two properties — kept separate per the machine's two declared
  properties), and **REFUTED the liveness candidate** — correctly reasoning
  that the trace's return to `edit` is a *voluntary* navigation, not an
  unfinishable flow, and that the spec declares no termination requirement to
  violate. That refutation is the hunt≠verify independence working: the
  checker killed a plausible-but-not-demonstrated candidate the hunter raised.
- Scores as expected against `sx-01/expected.md`: the required double-submit
  counterexample is found and CONFIRMED. The liveness candidate is NOT listed
  in expected.md (its only acceptable-extra is the `confirm`-guard ambiguity);
  it was correctly REFUTED rather than surviving, so it is not a false
  positive per the README's scoring definition.

## Verdict

- **Flat spec pipeline works end-to-end** — hunter → checker, both depth-1,
  no nested child, no hang. This is the ADR-0015 flattening applied to
  verify-spec, validated.
- **Detection: pass** (seeded loophole found, CONFIRMED, correct trace).
- **Precision: pass** (0 false positives; the checker refuted the one
  non-demonstrated candidate).
- Debt (per `../README.md`): one fixture exercises the pipeline but does not
  discriminate model tiers; add invariant / liveness / refinement fixtures
  before using this to compare models.
