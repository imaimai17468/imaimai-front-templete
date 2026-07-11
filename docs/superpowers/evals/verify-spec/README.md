# verify-spec golden eval

Seeded-loophole spec fixtures measuring the flat spec pipeline
(`spec-verifier` hunter + `spec-checker`, ADR-0010/0015). Each fixture is a
`*.spec.md` state machine with a **deliberate design loophole** plus an
`expected.md` naming the counterexample the pipeline must find.

Unlike the `review-diff` eval (which patches source files), these fixtures are
self-contained spec documents — nothing is applied to or reverted from the
working tree, so a run touches no source and needs no `git apply`.

## Run protocol (parent session)

Per fixture:

1. Dispatch the `spec-verifier` agent (hunter) with the fixture spec path — it
   returns `{ machine, ambiguities, candidates, incomplete }`.
2. Dispatch the `spec-checker` agent with that machine + candidates — it
   returns the CONFIRMED/PLAUSIBLE survivors.
3. Score off the survivors (below). Record subagent tokens + wall time for
   both dispatches.

No commit-gate stamp is involved (design-time). Run fixtures one at a time.

## Scoring

- **found** — the expected counterexample is reported as CONFIRMED (same
  property + same essential loophole; trace wording free).
- **missed** — the expected counterexample is absent from the survivors.
- **false positive** — a surviving CONFIRMED counterexample not in
  `expected.md` and not an acceptable extra.

## Fixture inventory

| id | spec | expected counterexample |
|---|---|---|
| sx-01 | two-step wizard with a `back` action | forbidden flow: reach `submitted` twice (double-submit) via back→confirm→back→confirm, because `confirm` has no guard against re-entry from `done` |

## Known coverage gaps (debt)

- Single fixture so far — enough to exercise the flat spec pipeline end to end
  (ADR-0015 validation), not enough to discriminate model tiers. Add
  invariant / liveness / refinement fixtures before using this to compare
  models.
