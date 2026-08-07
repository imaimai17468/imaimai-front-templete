# verify-spec golden eval

Seeded-loophole spec fixtures measuring the spec pipeline (the single
`spec-verifier` agent, ADR-0010/0029). Runs before 2026-08-07 measured two agents
(`spec-verifier` hunter + `spec-checker`, ADR-0015), so their token figures are
the sum of two contexts; they stay the comparison targets, read as totals. Each
fixture is a
`*.spec.md` state machine with a **deliberate design loophole** plus an
`expected.md` naming the counterexample the pipeline must find.

Unlike the `review-diff` eval (which patches source files), these fixtures are
self-contained spec documents — nothing is applied to or reverted from the
working tree, so a run touches no source and needs no `git apply`.

## Run protocol (parent session)

Per fixture:

1. Dispatch the `spec-verifier` agent with the fixture spec path — it runs all
   four stages in one context and returns
   `{ machine, ambiguities, counterexamples, incomplete }` with only the
   CONFIRMED/PLAUSIBLE survivors. The dispatch prompt MUST restrict reading to the
   fixture's spec file itself — not its `expected.md`, sibling fixtures, or this
   README (answer contamination; the same rule as the review-diff eval).
2. Record how many candidates the hunt raised and how many the replay refuted.
   Since ADR-0029 both stages share one context, a run that confirms everything
   it hunted is the failure mode to watch for, not a strong result.
3. Score off the survivors (below). Record subagent tokens + wall time for
   the dispatch.

No commit-gate stamp is involved (design-time). Run fixtures one at a time.

## Scoring

- **found** — the expected counterexample is reported as CONFIRMED (same
  property + same essential loophole; trace wording free).
- **missed** — the expected counterexample is absent from the survivors.
- **false positive** — a surviving CONFIRMED counterexample not in
  `expected.md` and not an acceptable extra.
- **Close calls need repeated runs** (same rule and sources as the
  review-diff eval): a single-run delta is decisive only when large and
  unanimous. The 2026-07-12 tier decision is a *boundary* example, not a
  license: its precision edge came from one fixture out of three (n=1,
  stochastic — the results doc says a re-run could land either way), and it
  qualified only because the cost signal independently pointed the same way,
  making the decision insensitive to the FP. A one-FP-apart result with
  mixed cost signals requires re-runs across separate sessions before
  acting.

## Fixture inventory

| id | spec | expected counterexample |
|---|---|---|
| sx-01 | two-step wizard with a `back` action | forbidden flow: reach `submitted` twice (double-submit) via back→confirm→back→confirm, because `confirm` has no guard against re-entry from `done` |
| sx-02 | 5-state checkout flow | liveness: `payment_failed` is a non-terminal dead end (no retry action), defeating R1; the voluntary browsing⇄cart cycle is a decoy that must NOT be confirmed |
| sx-03 | 4-state draft editor with autosave | refinement: legal trace `open_editor → (dirty draft) → session_timeout` silently discards edits, defeating R1 while every invariant/forbidden flow holds; the autosave self-loop is a decoy |

## Known coverage gaps (debt)

- Forbidden-flow (sx-01), liveness (sx-02), and refinement (sx-03) lenses are
  each covered by one fixture; no dedicated invariant-lens fixture yet
  (sx-01's single-submission invariant partially covers it).
- n=1 per fixture per run — tier comparisons should weight the harder
  sx-02/sx-03 results over sx-01.
