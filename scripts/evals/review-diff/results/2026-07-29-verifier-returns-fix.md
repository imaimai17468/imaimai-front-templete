# Verifier returns the fix (ADR-0020) — partial run, 2026-07-29

Gates the `review-diff` change that makes the verifier return `fix` and
`acceptance` for every finding it does not refute (ADR-0020). Both agents
sonnet, effort standard, protocol per `../README.md`. Runner: parent session
(Opus 5 1M) — the 2026-07-12 baselines were run by a Fable parent, so treat
small cost deltas as noise per the README's variance note.

**Scope: four fixtures, not eight** — agreed with the repository owner before
the run. fx-01 (detection), fx-06 (FP on a clean diff), fx-07 (discrimination in
a mixed diff), fx-08 (scale: detection + FP resistance across eight files).
fx-08's dimension is the one that bears most directly on ADR-0020's named risk,
since the fix-writing burden grows with the number of survivors. Not run:
fx-02 (type escape), fx-03 (render purity), fx-04 (swallowed error), fx-05
(limit/message contradiction) — all still apply cleanly and are unmeasured here.

## Scores

| fixture | found | missed | FP | tokens (finder+verifier) | wall |
|---|---|---|---|---|---|
| fx-01 (logic/boundary) | 1/1 CONFIRMED | 0 | 0 | 28.9k + 28.4k = **57.3k** | 31s + 26s |
| fx-06 (clean-diff FP probe) | n/a | n/a | **0** | 37.8k + 36.2k = **74.0k** | 55s + 24s |
| fx-07 (benign rename + state bug) | 1/1 CONFIRMED | 0 | 0 | 40.1k + 38.3k = **78.4k** | 60s + 48s |
| fx-08 (8 files, 2 defects) | 2/2 CONFIRMED | 0 | 0 | 43.0k + 33.7k = **76.7k** | 56s + 41s |
| **total** | **4/4** | **0** | **0** | **286.4k** | **341s** |

Plus 50.9k spent on a voided fx-08 finder run (see "What went wrong", below),
for 337.3k across the whole exercise.

## Against the baseline

| fixture | baseline outcome | baseline cost | this run | source (outcome / cost) |
|---|---|---|---|---|
| fx-01 | found | 59.0k, 69s | found, 57.3k, 57s | flat-pipeline / flat-pipeline |
| fx-06 | 0 FP | 70.3k, 49s | 0 FP, 74.0k, 79s | noise-suppression / flat-pipeline |
| fx-07 | found, 0 FP | 76.9k, 113s | found, 0 FP, 78.4k, 108s | noise-suppression / flat-pipeline |
| fx-08 | 2 found, 0 FP | 81.8k | 2 found, 0 FP, 76.7k | fx08-large-diff / fx08-large-diff |
| **total** | — | **288.0k** | **286.4k** | — |

Sources are `results/2026-07-12-flat-pipeline.md`,
`results/2026-07-12-noise-suppression.md` and
`results/2026-07-12-fx08-large-diff.md`. The outcome and cost columns cite
different files for fx-06 and fx-07 on purpose: the noise-suppression run is the
current-behaviour baseline for FP/detection but records no token figures, so the
costs come from the flat-pipeline run, which predates that tuning.

No detection regression, no new false positives, and 286.4k against 288.0k — flat.
The margins are inside the variance the README warns about, so the honest reading
is "no measurable change", not "cheaper". What this comparison does *not* cover is
listed under "Limits of this run" at the end.

## The risk ADR-0020 named

ADR-0020 predicted that a verifier asked to design remedies might refute less
rigorously, showing up as survivors that should have been refuted or as expected
findings missed. **No sign of it in these four fixtures** — read that together with
"Limits of this run" below, which bounds what four fixtures and one run each can
show. Specifically:

- fx-06 and fx-07's benign hunks were cleared, and in fx-07 the verifier
  independently agreed with the finder's decision not to flag a pure rename.
- fx-08's six benign files drew nothing while both defects came back CONFIRMED.
- Verifiers still did the tracing work: fx-01's ran `vitest` on the affected
  test file, fx-08's traced both boundary cases through `avatarSizeRejection` to
  its enforcing caller.

## Quality of the new fields

Four survivors across the run, plus six on this change's own review diff. Every
one carried a `fix` naming a specific edit (not a restatement) and an
`acceptance` that is checkable without re-running the review — commands in three
cases, an observable code state in the rest. Two worth quoting as the standard:

- fx-08: *"Revert the operator … This is the only correct shape — the function's
  contract (docstring lines 56-63) and every existing test case … require `>`,
  not `<`"*, accepted by running the affected test file.
- fx-01: identified the change as *"a one-character typo-style regression … not
  a deliberate relaxation"*, which is the judgement that distinguishes a fix
  from a guess.

The decision-exemption path was exercised for real on this change's own review:
asked whether to run the eval now or track it as debt, the verifier declined to
choose and returned the two credible options with their trade-off — which is the
behaviour the exemption exists for.

It also found a gap in the contract *while following it*: the exemption said what
`fix` should hold but not `acceptance`, so it had to invent a convention. Fixed
in the same change.

## What went wrong (measurement, not pipeline)

Two of the four fixtures were stale and had to be regenerated mid-run — the
README's staleness rule, exercised:

- **fx-06** — its premise (an inline `5 * 1024 * 1024` to extract) was gone: the
  2026-07-25 audit's W2 item had already moved the ceiling into
  `avatar-validation.ts`. Regenerated to the same kind of change.
- **fx-08** — referenced `src/lib/auth.ts`, renamed by that audit's W10 item, and
  seeded the size defect where the check no longer lives. Rebuilt to the same
  shape; `delta.patch` deleted rather than regenerated (ADR-0019 removed delta
  mode).

**The first fx-08 rebuild was wrong and the pipeline caught it.** Three of its
six "benign" edits were not benign: a comment asserting jsdom has no `scrollTo`
(it defines a not-implemented stub), a comment asserting when better-auth's
`signIn.social` promise resolves, and a constant declared between two imports.
The finder flagged all three with AGENTS.md Knowledge Currency citations. Those
were **not** false positives — they were correct findings against a defective
fixture, so the run was voided, the fixture corrected, and fx-08 re-run. On the
corrected fixture the same finder returned exactly the two seeded defects and
nothing else.

The lesson is about authoring, not reviewing: a fixture's benign edits must
assert nothing verifiable, or they stop being benign. Recorded in
`fx-08/expected.md` so the next person rebuilding it does not repeat it.

**And the correction was wrong too.** The replacement comment claimed the
`scrollTo` override exists so scrolling components can render — also false, for
the same reason in the other direction: jsdom emits a `jsdomError` that vitest
forwards to `console.error`, so nothing throws and rendering never depended on
it. The review of *this results file* caught that, a layer after the run. Two
attempts at a one-line comment produced two false claims; the third asserts
nothing. Worth recording because it says something about where the effort goes:
the reviewing side of this pipeline was more accurate than its author at every
step of this exercise.

## Limits of this run

- Four of eight fixtures. Detection on type-escape, render-purity and
  swallowed-error natures is unmeasured against this change.
- Nothing here scores `fix` / `acceptance` *quality* — no fixture has an expected
  fix, so a correct detection with a degraded remedy would still score clean. The
  assessment above is a reading of four survivors, not a measurement. Recorded as
  a coverage gap in `../README.md`.
- Single run per fixture. Per the README, only large unanimous deltas are
  decisive from one run; 4/4 detection with 0 FP against a 4/4-with-0-FP baseline
  is unanimous in the sense that matters here (no regression), but it cannot
  detect a small quality change.
